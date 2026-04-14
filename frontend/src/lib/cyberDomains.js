// Canonical list of cybersecurity investment domains.
// Keep in sync with backend/app/enrichment/cyber_domains.py (used in the AI prompt).

export const CYBER_DOMAINS = [
  // Application Security
  { key: 'sast', label: 'SAST', group: 'AppSec' },
  { key: 'dast', label: 'DAST', group: 'AppSec' },
  { key: 'iast', label: 'IAST', group: 'AppSec' },
  { key: 'sca', label: 'SCA', group: 'AppSec' },
  { key: 'aspm', label: 'ASPM', group: 'AppSec' },
  { key: 'api_security', label: 'API Security', group: 'AppSec' },
  { key: 'waap', label: 'WAF / WAAP', group: 'AppSec' },
  { key: 'secure_by_design', label: 'Secure by Design', group: 'AppSec' },
  { key: 'ai_pentesting', label: 'AI Pentesting', group: 'AppSec' },
  { key: 'pentesting', label: 'Pentesting / Red Team', group: 'AppSec' },
  { key: 'bug_bounty', label: 'Bug Bounty', group: 'AppSec' },

  // Cloud Security
  { key: 'cnapp', label: 'CNAPP', group: 'Cloud' },
  { key: 'cspm', label: 'CSPM', group: 'Cloud' },
  { key: 'cwpp', label: 'CWPP', group: 'Cloud' },
  { key: 'kspm', label: 'KSPM', group: 'Cloud' },
  { key: 'sspm', label: 'SSPM', group: 'Cloud' },
  { key: 'ciem', label: 'CIEM', group: 'Cloud' },
  { key: 'container_security', label: 'Container Security', group: 'Cloud' },
  { key: 'serverless_security', label: 'Serverless Security', group: 'Cloud' },

  // Exposure & Vulnerability Management
  { key: 'vulnerability_management', label: 'Vulnerability Mgmt', group: 'Exposure & VM' },
  { key: 'exposure_management', label: 'Exposure Mgmt', group: 'Exposure & VM' },
  { key: 'ctem', label: 'CTEM', group: 'Exposure & VM' },
  { key: 'asm_easm', label: 'ASM / EASM', group: 'Exposure & VM' },
  { key: 'caasm', label: 'CAASM', group: 'Exposure & VM' },
  { key: 'scanning', label: 'Scanning', group: 'Exposure & VM' },
  { key: 'prioritization', label: 'Prioritization', group: 'Exposure & VM' },
  { key: 'remediation', label: 'Remediation', group: 'Exposure & VM' },
  { key: 'patch_management', label: 'Patch Mgmt', group: 'Exposure & VM' },
  { key: 'posture_management', label: 'Posture Mgmt', group: 'Exposure & VM' },
  { key: 'bas', label: 'Breach & Attack Sim', group: 'Exposure & VM' },

  // Identity & Access
  { key: 'iam', label: 'IAM', group: 'Identity' },
  { key: 'iga', label: 'IGA', group: 'Identity' },
  { key: 'pam', label: 'PAM', group: 'Identity' },
  { key: 'itdr', label: 'ITDR', group: 'Identity' },
  { key: 'ciam', label: 'CIAM', group: 'Identity' },
  { key: 'secrets_management', label: 'Secrets Mgmt', group: 'Identity' },
  { key: 'mfa_passwordless', label: 'MFA / Passwordless', group: 'Identity' },

  // Endpoint
  { key: 'edr', label: 'EDR', group: 'Endpoint' },
  { key: 'xdr', label: 'XDR', group: 'Endpoint' },
  { key: 'epp', label: 'EPP', group: 'Endpoint' },
  { key: 'mdm_uem', label: 'MDM / UEM', group: 'Endpoint' },
  { key: 'mobile_security', label: 'Mobile Security', group: 'Endpoint' },

  // Network
  { key: 'ndr', label: 'NDR', group: 'Network' },
  { key: 'firewall_ngfw', label: 'Firewall / NGFW', group: 'Network' },
  { key: 'ztna', label: 'ZTNA', group: 'Network' },
  { key: 'sase', label: 'SASE', group: 'Network' },
  { key: 'sse', label: 'SSE', group: 'Network' },
  { key: 'swg', label: 'SWG', group: 'Network' },
  { key: 'microsegmentation', label: 'Microsegmentation', group: 'Network' },
  { key: 'ddos_protection', label: 'DDoS Protection', group: 'Network' },

  // Data
  { key: 'dlp', label: 'DLP', group: 'Data' },
  { key: 'dspm', label: 'DSPM', group: 'Data' },
  { key: 'data_encryption', label: 'Data Encryption', group: 'Data' },
  { key: 'database_security', label: 'Database Security', group: 'Data' },

  // Detection & Response
  { key: 'siem', label: 'SIEM', group: 'Detection & Response' },
  { key: 'soar', label: 'SOAR', group: 'Detection & Response' },
  { key: 'mdr', label: 'MDR', group: 'Detection & Response' },
  { key: 'threat_intelligence', label: 'Threat Intel', group: 'Detection & Response' },
  { key: 'deception', label: 'Deception', group: 'Detection & Response' },
  { key: 'ueba', label: 'UEBA', group: 'Detection & Response' },

  // GRC & Risk
  { key: 'grc', label: 'GRC', group: 'GRC & Risk' },
  { key: 'compliance_automation', label: 'Compliance Automation', group: 'GRC & Risk' },
  { key: 'tprm', label: 'Third-Party Risk', group: 'GRC & Risk' },
  { key: 'privacy', label: 'Privacy', group: 'GRC & Risk' },
  { key: 'insider_risk', label: 'Insider Risk', group: 'GRC & Risk' },

  // Email & Web
  { key: 'email_security', label: 'Email Security', group: 'Email & Web' },
  { key: 'anti_phishing', label: 'Anti-Phishing / BEC', group: 'Email & Web' },
  { key: 'browser_security', label: 'Browser Security', group: 'Email & Web' },
  { key: 'bot_management', label: 'Bot Management', group: 'Email & Web' },
  { key: 'fraud_prevention', label: 'Fraud Prevention', group: 'Email & Web' },

  // OT / IoT
  { key: 'ot_security', label: 'OT / ICS Security', group: 'OT & IoT' },
  { key: 'iot_security', label: 'IoT Security', group: 'OT & IoT' },

  // AI Security
  { key: 'ai_spm', label: 'AI-SPM', group: 'AI Security' },
  { key: 'llm_security', label: 'LLM / GenAI Security', group: 'AI Security' },
  { key: 'model_security', label: 'Model Security', group: 'AI Security' },

  // Software Supply Chain
  { key: 'supply_chain_security', label: 'Supply Chain Security', group: 'Supply Chain' },
  { key: 'sbom', label: 'SBOM', group: 'Supply Chain' },
  { key: 'iac_security', label: 'IaC Security', group: 'Supply Chain' },
  { key: 'secrets_scanning', label: 'Secrets Scanning', group: 'Supply Chain' },
  { key: 'code_security', label: 'Code Security', group: 'Supply Chain' },

  // Other
  { key: 'security_awareness', label: 'Security Awareness', group: 'Other' },
  { key: 'quantum_pqc', label: 'Quantum / PQC', group: 'Other' },
  { key: 'hardware_security', label: 'Hardware Security', group: 'Other' },
  { key: 'devsecops', label: 'DevSecOps', group: 'Other' },
]

export const CYBER_DOMAIN_KEYS = CYBER_DOMAINS.map((d) => d.key)

export const CYBER_DOMAIN_GROUPS = CYBER_DOMAINS.reduce((acc, d) => {
  if (!acc[d.group]) acc[d.group] = []
  acc[d.group].push(d)
  return acc
}, {})
