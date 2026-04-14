"""Canonical cybersecurity investment domains.

Keep in sync with frontend/src/lib/cyberDomains.js — both files enumerate the
landscape used to map VC portfolio coverage. The AI enrichment prompt instructs
Vertex to return a boolean for every key here.
"""
from __future__ import annotations

CYBER_DOMAINS: list[tuple[str, str, str]] = [
    # (key, label, group)
    ("sast", "SAST", "AppSec"),
    ("dast", "DAST", "AppSec"),
    ("iast", "IAST", "AppSec"),
    ("sca", "SCA", "AppSec"),
    ("aspm", "ASPM", "AppSec"),
    ("api_security", "API Security", "AppSec"),
    ("waap", "WAF / WAAP", "AppSec"),
    ("secure_by_design", "Secure by Design", "AppSec"),
    ("ai_pentesting", "AI Pentesting", "AppSec"),
    ("pentesting", "Pentesting / Red Team", "AppSec"),
    ("bug_bounty", "Bug Bounty", "AppSec"),

    ("cnapp", "CNAPP", "Cloud"),
    ("cspm", "CSPM", "Cloud"),
    ("cwpp", "CWPP", "Cloud"),
    ("kspm", "KSPM", "Cloud"),
    ("sspm", "SSPM", "Cloud"),
    ("ciem", "CIEM", "Cloud"),
    ("container_security", "Container Security", "Cloud"),
    ("serverless_security", "Serverless Security", "Cloud"),

    ("vulnerability_management", "Vulnerability Management", "Exposure & VM"),
    ("exposure_management", "Exposure Management", "Exposure & VM"),
    ("ctem", "CTEM", "Exposure & VM"),
    ("asm_easm", "ASM / EASM", "Exposure & VM"),
    ("caasm", "CAASM", "Exposure & VM"),
    ("scanning", "Scanning", "Exposure & VM"),
    ("prioritization", "Prioritization", "Exposure & VM"),
    ("remediation", "Remediation", "Exposure & VM"),
    ("patch_management", "Patch Management", "Exposure & VM"),
    ("posture_management", "Posture Management", "Exposure & VM"),
    ("bas", "Breach & Attack Simulation", "Exposure & VM"),

    ("iam", "IAM", "Identity"),
    ("iga", "IGA", "Identity"),
    ("pam", "PAM", "Identity"),
    ("itdr", "ITDR", "Identity"),
    ("ciam", "CIAM", "Identity"),
    ("secrets_management", "Secrets Management", "Identity"),
    ("mfa_passwordless", "MFA / Passwordless", "Identity"),

    ("edr", "EDR", "Endpoint"),
    ("xdr", "XDR", "Endpoint"),
    ("epp", "EPP", "Endpoint"),
    ("mdm_uem", "MDM / UEM", "Endpoint"),
    ("mobile_security", "Mobile Security", "Endpoint"),

    ("ndr", "NDR", "Network"),
    ("firewall_ngfw", "Firewall / NGFW", "Network"),
    ("ztna", "ZTNA", "Network"),
    ("sase", "SASE", "Network"),
    ("sse", "SSE", "Network"),
    ("swg", "SWG", "Network"),
    ("microsegmentation", "Microsegmentation", "Network"),
    ("ddos_protection", "DDoS Protection", "Network"),

    ("dlp", "DLP", "Data"),
    ("dspm", "DSPM", "Data"),
    ("data_encryption", "Data Encryption", "Data"),
    ("database_security", "Database Security", "Data"),

    ("siem", "SIEM", "Detection & Response"),
    ("soar", "SOAR", "Detection & Response"),
    ("mdr", "MDR", "Detection & Response"),
    ("threat_intelligence", "Threat Intelligence", "Detection & Response"),
    ("deception", "Deception", "Detection & Response"),
    ("ueba", "UEBA", "Detection & Response"),

    ("grc", "GRC", "GRC & Risk"),
    ("compliance_automation", "Compliance Automation", "GRC & Risk"),
    ("tprm", "Third-Party Risk Management", "GRC & Risk"),
    ("privacy", "Privacy", "GRC & Risk"),
    ("insider_risk", "Insider Risk", "GRC & Risk"),

    ("email_security", "Email Security", "Email & Web"),
    ("anti_phishing", "Anti-Phishing / BEC", "Email & Web"),
    ("browser_security", "Browser Security", "Email & Web"),
    ("bot_management", "Bot Management", "Email & Web"),
    ("fraud_prevention", "Fraud Prevention", "Email & Web"),

    ("ot_security", "OT / ICS Security", "OT & IoT"),
    ("iot_security", "IoT Security", "OT & IoT"),

    ("ai_spm", "AI-SPM", "AI Security"),
    ("llm_security", "LLM / GenAI Security", "AI Security"),
    ("model_security", "Model Security", "AI Security"),

    ("supply_chain_security", "Supply Chain Security", "Supply Chain"),
    ("sbom", "SBOM", "Supply Chain"),
    ("iac_security", "IaC Security", "Supply Chain"),
    ("secrets_scanning", "Secrets Scanning", "Supply Chain"),
    ("code_security", "Code Security", "Supply Chain"),

    ("security_awareness", "Security Awareness", "Other"),
    ("quantum_pqc", "Quantum / PQC", "Other"),
    ("hardware_security", "Hardware Security", "Other"),
    ("devsecops", "DevSecOps", "Other"),
]

CYBER_DOMAIN_KEYS: list[str] = [k for k, _, _ in CYBER_DOMAINS]


def render_domains_for_prompt() -> str:
    """Render the canonical domain list as grouped bullets for the AI prompt."""
    by_group: dict[str, list[tuple[str, str]]] = {}
    for key, label, group in CYBER_DOMAINS:
        by_group.setdefault(group, []).append((key, label))

    lines: list[str] = []
    for group, items in by_group.items():
        lines.append(f"  {group}:")
        for key, label in items:
            lines.append(f"    - {key}  ({label})")
    return "\n".join(lines)
