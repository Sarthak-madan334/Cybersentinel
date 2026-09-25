use chrono::{DateTime, Utc};
use colored::Colorize;
use serde::Serialize;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::process::Command;

const BACKDOOR_PORTS: &[u16] = &[4444, 1337, 31337, 6666, 6667, 12345, 54321];
const SUSPICIOUS_PROCESS_INDICATORS: &[&str] = &[
    "nc -l", "ncat", "nmap", "mimikatz", "meterpreter", "xmrig", "/tmp/", "/dev/shm/",
];

#[derive(Debug, Serialize, Clone)]
struct Evidence {
    field: String,
    value: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq, PartialOrd, Ord)]
enum SeverityTier {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

impl SeverityTier {
    fn label(&self) -> &'static str {
        match self {
            Self::Critical => "Critical",
            Self::High => "High",
            Self::Medium => "Medium",
            Self::Low => "Low",
            Self::Info => "Info",
        }
    }
}

#[derive(Debug, Serialize, Clone)]
struct Finding {
    incident_id: String,
    category: String,
    severity: u8,
    severity_tier: SeverityTier,
    source_ip: Option<String>,
    host: String,
    status: String,
    evidence: Vec<Evidence>,
    narrative: String,
    recommended_response: String,
    created_at: DateTime<Utc>,
    resolved_at: Option<DateTime<Utc>>,
}

struct CheckResult {
    findings: Vec<Finding>,
    skipped_message: Option<String>,
}

fn hostname() -> String {
    env::var("HOSTNAME")
        .or_else(|_| env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "localhost".to_string())
}

fn command_output(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|_| format!("check skipped: `{program}` is not available"))?;
    if !output.status.success() {
        return Err(format!("check skipped: `{program}` returned a non-zero exit status"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn finding(
    id: usize,
    category: &str,
    severity: u8,
    tier: SeverityTier,
    source_ip: Option<String>,
    host: &str,
    evidence: Vec<Evidence>,
    narrative: String,
    response: &str,
) -> Finding {
    Finding {
        incident_id: format!("cli-inc-{:04}", id),
        category: category.to_string(),
        severity,
        severity_tier: tier,
        source_ip,
        host: host.to_string(),
        status: "New".to_string(),
        evidence,
        narrative,
        recommended_response: response.to_string(),
        created_at: Utc::now(),
        resolved_at: None,
    }
}

fn port_from_address(value: &str) -> Option<u16> {
    value.rsplit(':').next()?.trim_matches(|c| c == '[' || c == ']').parse().ok()
}

fn check_listening_ports(host: &str, next_id: &mut usize) -> CheckResult {
    let output = match command_output("ss", &["-tuln"]) {
        Ok(value) => value,
        Err(message) => return CheckResult { findings: vec![], skipped_message: Some(message) },
    };
    let mut findings = Vec::new();
    for line in output.lines().filter(|line| line.contains("LISTEN") || line.contains("UNCONN")) {
        let fields: Vec<&str> = line.split_whitespace().collect();
        let Some(address) = fields.get(4).or_else(|| fields.get(3)) else { continue };
        let Some(port) = port_from_address(address) else { continue };
        let is_backdoor = BACKDOOR_PORTS.contains(&port);
        let (severity, tier, category, response) = if is_backdoor {
            (75, SeverityTier::High, "Suspicious Listening Port", "Identify the owning process, restrict the port at the firewall, and preserve process evidence.")
        } else {
            (15, SeverityTier::Info, "Open Listening Port", "Validate that this service and listening port are expected for this host.")
        };
        let narrative = if is_backdoor {
            format!("Local service is listening on port {port}, a port commonly associated with backdoors or reverse shells.")
        } else {
            format!("Local service is listening on port {port}; this informational finding requires service ownership validation.")
        };
        findings.push(finding(*next_id, category, severity, tier, None, host, vec![
            Evidence { field: "local_address".to_string(), value: (*address).to_string() },
            Evidence { field: "port".to_string(), value: port.to_string() },
        ], narrative, response));
        *next_id += 1;
    }
    CheckResult { findings, skipped_message: None }
}

fn failed_ssh_log() -> Result<String, String> {
    match command_output("journalctl", &["-u", "ssh", "--no-pager", "-n", "1000"]) {
        Ok(logs) if logs.contains("Failed password") => Ok(logs),
        _ => fs::read_to_string("/var/log/auth.log").map_err(|_| "check skipped: SSH journal is unavailable and /var/log/auth.log could not be read".to_string()),
    }
}

fn source_ip_from_failed_login(line: &str) -> Option<String> {
    let marker = " from ";
    let after = line.split_once(marker)?.1;
    let candidate = after.split_whitespace().next()?;
    if candidate.parse::<std::net::IpAddr>().is_ok() { Some(candidate.to_string()) } else { None }
}

fn check_failed_ssh_logins(host: &str, next_id: &mut usize) -> CheckResult {
    let logs = match failed_ssh_log() {
        Ok(value) => value,
        Err(message) => return CheckResult { findings: vec![], skipped_message: Some(message) },
    };
    let mut attempts: HashMap<String, usize> = HashMap::new();
    for line in logs.lines().filter(|line| line.contains("Failed password")) {
        if let Some(ip) = source_ip_from_failed_login(line) { *attempts.entry(ip).or_default() += 1; }
    }
    let mut findings = Vec::new();
    for (ip, count) in attempts.into_iter().filter(|(_, count)| *count >= 5) {
        let (severity, tier) = if count >= 10 { (70, SeverityTier::High) } else { (45, SeverityTier::Medium) };
        findings.push(finding(*next_id, "Brute Force", severity, tier, Some(ip.clone()), host, vec![
            Evidence { field: "failed_ssh_attempts".to_string(), value: count.to_string() },
            Evidence { field: "source_ip".to_string(), value: ip.clone() },
        ], format!("Source IP {ip} made {count} failed SSH password attempts, exceeding the deterministic brute-force threshold."), "Block source IP at the firewall and review authentication logs for successful follow-on access."));
        *next_id += 1;
    }
    CheckResult { findings, skipped_message: None }
}

fn check_suspicious_processes(host: &str, next_id: &mut usize) -> CheckResult {
    let output = match command_output("ps", &["aux"]) {
        Ok(value) => value,
        Err(message) => return CheckResult { findings: vec![], skipped_message: Some(message) },
    };
    let mut findings = Vec::new();
    for line in output.lines().skip(1) {
        let lower = line.to_lowercase();
        if let Some(indicator) = SUSPICIOUS_PROCESS_INDICATORS.iter().find(|needle| lower.contains(*needle)) {
            findings.push(finding(*next_id, "Malware Execution Pattern", 75, SeverityTier::High, None, host, vec![
                Evidence { field: "process_indicator".to_string(), value: (*indicator).to_string() },
                Evidence { field: "process_line".to_string(), value: line.to_string() },
            ], format!("A running process matched the suspicious indicator `{indicator}`."), "Inspect the process owner and command line, terminate it if unauthorized, and collect endpoint evidence."));
            *next_id += 1;
        }
    }
    CheckResult { findings, skipped_message: None }
}

fn print_report(findings: &[Finding], skipped: &[String]) {
    println!("\n{}", "CyberSentinel local scan".bold());
    println!("Host: {} | Findings: {}\n", findings.first().map(|f| f.host.as_str()).unwrap_or("localhost"), findings.len());
    for message in skipped { println!("{} {message}", "•".yellow()); }
    for tier in [SeverityTier::Critical, SeverityTier::High, SeverityTier::Medium, SeverityTier::Low, SeverityTier::Info] {
        let group: Vec<&Finding> = findings.iter().filter(|finding| finding.severity_tier == tier).collect();
        if group.is_empty() { continue; }
        let heading = format!("{} ({})", tier.label(), group.len());
        let coloured = match tier { SeverityTier::Critical | SeverityTier::High => heading.red(), SeverityTier::Medium => heading.yellow(), SeverityTier::Low | SeverityTier::Info => heading.green() };
        println!("\n{coloured}");
        for item in group {
            println!("  {} — {}", item.category.bold(), item.narrative);
            for proof in &item.evidence { println!("    {}: {}", proof.field.dimmed(), proof.value); }
        }
    }
    if findings.is_empty() && skipped.is_empty() { println!("{} No findings met the configured deterministic thresholds.", "✓".green()); }
}

fn export_json(findings: &[Finding]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(findings).map_err(|error| error.to_string())?;
    fs::write("findings.json", json).map_err(|error| error.to_string())?;
    println!("\n{} Wrote {} finding(s) to findings.json", "✓".green(), findings.len());
    Ok(())
}

fn main() {
    let wants_json = env::args().skip(1).any(|argument| argument == "--json");
    let host = hostname();
    let mut next_id = 1;
    let checks = [
        check_listening_ports(&host, &mut next_id),
        check_failed_ssh_logins(&host, &mut next_id),
        check_suspicious_processes(&host, &mut next_id),
    ];
    let findings: Vec<Finding> = checks.iter().flat_map(|result| result.findings.clone()).collect();
    let skipped: Vec<String> = checks.iter().filter_map(|result| result.skipped_message.clone()).collect();
    print_report(&findings, &skipped);
    if wants_json { if let Err(error) = export_json(&findings) { eprintln!("Failed to write findings.json: {error}"); std::process::exit(1); } }
}
