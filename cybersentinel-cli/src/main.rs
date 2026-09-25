use chrono::{DateTime, Utc};
use colored::Colorize;
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::{env, fs};
use std::path::Path;
use std::process::Command;

const BACKDOOR_PORTS: &[u16] = &[4444, 1337, 31337, 6666, 6667, 12345, 54321];
const EXACT_TOOLS: &[&str] = &["ncat", "nmap", "mimikatz", "meterpreter", "xmrig"];

#[derive(Debug, Serialize, Clone)] struct Evidence { field: String, value: String }
#[derive(Debug, Serialize, Clone, PartialEq, Eq, PartialOrd, Ord)] enum SeverityTier { Critical, High, Medium, Low, Info }
impl SeverityTier { fn label(&self) -> &'static str { match self { Self::Critical => "Critical", Self::High => "High", Self::Medium => "Medium", Self::Low => "Low", Self::Info => "Info" } } }
#[derive(Debug, Serialize, Clone)] struct Finding { incident_id: String, category: String, severity: u8, severity_tier: SeverityTier, source_ip: Option<String>, host: String, status: String, evidence: Vec<Evidence>, narrative: String, recommended_response: String, created_at: DateTime<Utc>, resolved_at: Option<DateTime<Utc>> }
struct CheckResult { name: &'static str, findings: Vec<Finding>, skipped_message: Option<String> }

fn command_output(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program).args(args).output().map_err(|_| format!("check skipped: `{program}` is not available"))?;
    if !output.status.success() { return Err(format!("check skipped: `{program}` returned a non-zero exit status")); }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
fn hostname() -> String { command_output("hostname", &[]).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).or_else(|| env::var("HOSTNAME").ok()).unwrap_or_else(|| "localhost".to_string()) }
fn finding(id: usize, category: &str, severity: u8, tier: SeverityTier, source_ip: Option<String>, host: &str, evidence: Vec<Evidence>, narrative: String, response: &str) -> Finding {
    Finding { incident_id: format!("cli-inc-{id:04}"), category: category.to_string(), severity, severity_tier: tier, source_ip, host: host.to_string(), status: "New".to_string(), evidence, narrative, recommended_response: response.to_string(), created_at: Utc::now(), resolved_at: None }
}
fn port_from_address(value: &str) -> Option<u16> { value.rsplit(':').next()?.trim_matches(|c| c == '[' || c == ']').parse().ok() }

fn check_listening_ports(host: &str, next_id: &mut usize) -> CheckResult {
    let output = match command_output("ss", &["-tuln"]) { Ok(value) => value, Err(message) => return CheckResult { name: "Listening ports", findings: vec![], skipped_message: Some(message) } };
    let mut listeners: BTreeMap<u16, Vec<String>> = BTreeMap::new();
    for line in output.lines().skip(1).filter(|line| line.contains("LISTEN") || line.contains("UNCONN")) {
        let fields: Vec<&str> = line.split_whitespace().collect();
        let (Some(protocol), Some(address)) = (fields.first(), fields.get(4)) else { continue };
        let Some(port) = port_from_address(address) else { continue };
        let entry = format!("{} {}", protocol.to_uppercase(), address);
        let values = listeners.entry(port).or_default();
        if !values.contains(&entry) { values.push(entry); }
    }
    let mut findings = Vec::new();
    for (port, addresses) in listeners {
        let known_backdoor = BACKDOOR_PORTS.contains(&port);
        let (severity, tier, category, response) = if known_backdoor { (75, SeverityTier::High, "Suspicious Listening Port", "Identify the owning process, restrict the port at the firewall, and preserve process evidence.") } else { (15, SeverityTier::Info, "Open Listening Port", "Validate that this service and listening port are expected for this host.") };
        let narrative = if known_backdoor { format!("A local service is listening on port {port}, a port commonly associated with backdoors or reverse shells.") } else { format!("A local service is listening on port {port}; this informational finding requires service ownership validation.") };
        findings.push(finding(*next_id, category, severity, tier, None, host, vec![Evidence { field: "port".to_string(), value: port.to_string() }, Evidence { field: "listeners".to_string(), value: addresses.join(" | ") }], narrative, response));
        *next_id += 1;
    }
    CheckResult { name: "Listening ports", findings, skipped_message: None }
}

fn failed_ssh_log() -> Result<String, String> { match command_output("journalctl", &["-u", "ssh", "--no-pager", "-n", "1000"]) { Ok(logs) if logs.contains("Failed password") => Ok(logs), _ => fs::read_to_string("/var/log/auth.log").map_err(|_| "check skipped: SSH journal is unavailable and /var/log/auth.log could not be read".to_string()) } }
fn source_ip_from_failed_login(line: &str) -> Option<String> { let candidate = line.split_once(" from ")?.1.split_whitespace().next()?; candidate.parse::<std::net::IpAddr>().ok().map(|_| candidate.to_string()) }
fn check_failed_ssh_logins(host: &str, next_id: &mut usize) -> CheckResult {
    let logs = match failed_ssh_log() { Ok(value) => value, Err(message) => return CheckResult { name: "Failed SSH logins", findings: vec![], skipped_message: Some(message) } };
    let mut attempts: HashMap<String, usize> = HashMap::new();
    for line in logs.lines().filter(|line| line.contains("Failed password")) { if let Some(ip) = source_ip_from_failed_login(line) { *attempts.entry(ip).or_default() += 1; } }
    let mut sorted: Vec<_> = attempts.into_iter().filter(|(_, count)| *count >= 5).collect(); sorted.sort_by(|a, b| b.1.cmp(&a.1));
    let mut findings = Vec::new();
    for (ip, count) in sorted {
        let (severity, tier) = if count >= 10 { (70, SeverityTier::High) } else { (45, SeverityTier::Medium) };
        let rule = if count >= 10 { "10+ attempts: High" } else { "5+ attempts: Medium" };
        findings.push(finding(*next_id, "Brute Force", severity, tier, Some(ip.clone()), host, vec![Evidence { field: "failed_ssh_attempts".to_string(), value: count.to_string() }, Evidence { field: "source_ip".to_string(), value: ip.clone() }, Evidence { field: "detection_rule".to_string(), value: rule.to_string() }], format!("Source IP {ip} made {count} failed SSH password attempts, exceeding the deterministic brute-force threshold."), "Block source IP at the firewall and review authentication logs for successful follow-on access.")); *next_id += 1;
    }
    CheckResult { name: "Failed SSH logins", findings, skipped_message: None }
}

fn executable_name(command: &str) -> String { Path::new(command).file_name().and_then(|value| value.to_str()).unwrap_or(command).to_ascii_lowercase() }
fn suspicious_process_indicator(command: &str, args: &str) -> Option<&'static str> {
    let executable = executable_name(command);
    if EXACT_TOOLS.contains(&executable.as_str()) { return EXACT_TOOLS.iter().copied().find(|tool| *tool == executable); }
    let tokens: Vec<&str> = args.split_whitespace().collect();
    if matches!(executable.as_str(), "nc" | "netcat") && tokens.iter().any(|token| matches!(*token, "-l" | "--listen")) { return Some("netcat listener"); }
    if tokens.iter().any(|token| token.starts_with("/tmp/") || token.starts_with("/dev/shm/")) { return Some("execution from temporary path"); }
    None
}
fn check_suspicious_processes(host: &str, next_id: &mut usize) -> CheckResult {
    let output = match command_output("ps", &["-eo", "user=,pid=,comm=,args="]) { Ok(value) => value, Err(message) => return CheckResult { name: "Suspicious processes", findings: vec![], skipped_message: Some(message) } };
    let mut findings = Vec::new();
    for line in output.lines() {
        let fields: Vec<&str> = line.trim_start().splitn(4, char::is_whitespace).filter(|field| !field.is_empty()).collect();
        if fields.len() != 4 { continue; }
        let (user, pid, command, args) = (fields[0], fields[1], fields[2], fields[3]);
        if let Some(indicator) = suspicious_process_indicator(command, args) {
            findings.push(finding(*next_id, "Malware Execution Pattern", 75, SeverityTier::High, None, host, vec![Evidence { field: "process_id".to_string(), value: pid.to_string() }, Evidence { field: "process_user".to_string(), value: user.to_string() }, Evidence { field: "process_indicator".to_string(), value: indicator.to_string() }, Evidence { field: "command_line".to_string(), value: args.to_string() }], format!("Process {pid} owned by {user} matched the deterministic suspicious indicator `{indicator}`."), "Inspect the process owner and command line, terminate it if unauthorized, and collect endpoint evidence.")); *next_id += 1;
        }
    }
    CheckResult { name: "Suspicious processes", findings, skipped_message: None }
}

fn print_report(findings: &[Finding], checks: &[CheckResult], host: &str) {
    println!("\n{}", "CyberSentinel local security scan".bold()); println!("Host: {host} | Checks: {} | Findings: {}", checks.len(), findings.len());
    for check in checks { let status = if check.skipped_message.is_some() { "SKIPPED".yellow() } else { "COMPLETE".green() }; println!("  [{}] {} — {} finding(s)", status, check.name, check.findings.len()); if let Some(message) = &check.skipped_message { println!("    {message}"); } }
    for tier in [SeverityTier::Critical, SeverityTier::High, SeverityTier::Medium, SeverityTier::Low, SeverityTier::Info] {
        let group: Vec<&Finding> = findings.iter().filter(|finding| finding.severity_tier == tier).collect(); if group.is_empty() { continue; }
        let heading = format!("{} ({})", tier.label(), group.len()); let heading = match tier { SeverityTier::Critical | SeverityTier::High => heading.red(), SeverityTier::Medium => heading.yellow(), SeverityTier::Low | SeverityTier::Info => heading.green() }; println!("\n{heading}");
        for item in group { println!("  {} — {}", item.category.bold(), item.narrative); for proof in &item.evidence { println!("    {}: {}", proof.field.dimmed(), proof.value); } println!("    {}: {}", "response".dimmed(), item.recommended_response); }
    }
    if findings.is_empty() { println!("\n{} No findings met the configured deterministic thresholds.", "✓".green()); }
}
fn export_json(findings: &[Finding]) -> Result<(), String> { fs::write("findings.json", serde_json::to_string_pretty(findings).map_err(|error| error.to_string())?).map_err(|error| error.to_string())?; println!("\n{} Wrote {} dashboard-compatible finding(s) to findings.json", "✓".green(), findings.len()); Ok(()) }
fn print_help() { println!("CyberSentinel CLI\n\nUsage: cybersentinel-cli [--json]\n\n  --json  Write dashboard-compatible findings to findings.json\n  --help  Show this help text"); }
fn main() {
    let arguments: Vec<String> = env::args().skip(1).collect(); if arguments.iter().any(|argument| argument == "--help" || argument == "-h") { print_help(); return; }
    let host = hostname(); let mut next_id = 1; let checks = vec![check_listening_ports(&host, &mut next_id), check_failed_ssh_logins(&host, &mut next_id), check_suspicious_processes(&host, &mut next_id)]; let findings: Vec<Finding> = checks.iter().flat_map(|result| result.findings.clone()).collect(); print_report(&findings, &checks, &host);
    if arguments.iter().any(|argument| argument == "--json") { if let Err(error) = export_json(&findings) { eprintln!("Failed to write findings.json: {error}"); std::process::exit(1); } }
}

#[cfg(test)] mod tests { use super::*; #[test] fn does_not_match_ncat_inside_unrelated_word() { assert_eq!(suspicious_process_indicator("plan9", "plan9 --log-truncate"), None); } #[test] fn matches_actual_ncat_executable() { assert_eq!(suspicious_process_indicator("ncat", "ncat -l 4444"), Some("ncat")); } #[test] fn matches_netcat_listener() { assert_eq!(suspicious_process_indicator("nc", "nc -l -p 4444"), Some("netcat listener")); } }
