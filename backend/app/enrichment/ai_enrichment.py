"""Vertex AI enrichment layer.

Runs portfolio conflict detection and generates investment intelligence
using Google Vertex AI (Gemini) as the reasoning engine.
"""
from __future__ import annotations
import json
import logging
from google.api_core import exceptions as gcp_exceptions
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from vertexai.generative_models import GenerativeModel, GenerationConfig

from app.config import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an investor intelligence analyst for a cybersecurity startup called Hakuna.

Context about Hakuna:
- Founder: Itamar — founded Cymptom (acquired by Tenable), led Tenable Exposure Management BU.
- Raise: seed round, cybersecurity focus, exact positioning still being determined.
- Space: vulnerability management / exposure management broadly.

Possible product directions include:
- Next-gen VM scanning + advanced prioritization agent
- Autonomous vulnerability remediation
- Composable / low-code exposure management platform for enterprises

Do NOT assume a specific product direction. Instead, map the full competitive
landscape in the VM/EM space so the founder can navigate it across all three options.

For conflict detection, flag portfolio companies in ANY of these categories:
- Vulnerability scanners (agent or agentless)
- Vulnerability prioritization and risk scoring
- Automated or agentic remediation
- Exposure management platforms
- Attack surface management (ASM / EASM)
- CAASM (cyber asset attack surface management)
- Patch management
- Security posture management (CSPM, KSPM, SSPM)

Conflict verdict logic:
  "blocking"   → portfolio company competes in 2+ of the above categories
  "adjacent"   → overlaps in 1 category, different buyer or GTM
  "watching"   → early/adjacent, worth monitoring as space evolves
  "validating" → validates the space without competing (e.g. SIEM, ticketing,
                 identity — something that would integrate with Hakuna)
  "clear"      → no meaningful overlap"""

USER_PROMPT_TEMPLATE = """Analyze the following investor for Hakuna's fundraise.

**Investor: {investor_name}**

**Portfolio Companies:**
{portfolio_list}

**News Signals:**
{news_summary}

**Crunchbase Data:**
- Fund size: {fund_size}
- Stage focus: {stage_focus}
- Geo focus: {geo_focus}

**Partners:**
{partners_list}

Produce a JSON response with EXACTLY this structure (no markdown, no code fences, just valid JSON):
{{
  "vm_em_portfolio_map": {{
    "blocking":    ["Company — one-line reason"],
    "adjacent":    ["Company — one-line reason"],
    "watching":    ["Company — one-line reason"],
    "validating":  ["Company — one-line reason"],
    "clear":       ["Company — one-line reason"]
  }},
  "space_coverage": {{
    "scanning":           true or false,
    "prioritization":     true or false,
    "remediation":        true or false,
    "asm_easm":           true or false,
    "caasm":              true or false,
    "patch_management":   true or false,
    "posture_management": true or false
  }},
  "thesis_inference": "What does this fund's portfolio suggest they believe about how VM/EM evolves?",
  "whitespace_signal": "Based on their portfolio gaps, which of the three Hakuna directions would least conflict and most interest them?",
  "partner_domain_fit": "Which partner at this firm has the strongest security or infrastructure background?",
  "suggested_angle": "How should Itamar approach this fund given his Cymptom/Tenable background — without pitching a specific product yet?",
  "research_gaps": ["what is still unknown that would change this assessment"]
}}"""

_vertexai_initialized = False


def _get_model() -> GenerativeModel:
    global _vertexai_initialized
    if not _vertexai_initialized:
        import vertexai

        settings = get_settings()
        vertexai.init(project=settings.vertex_project, location=settings.vertex_location)
        _vertexai_initialized = True

    settings = get_settings()
    return GenerativeModel(
        settings.vertex_model,
        system_instruction=SYSTEM_PROMPT,
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=5, max=60),
    retry=retry_if_exception_type((gcp_exceptions.ServiceUnavailable, gcp_exceptions.ResourceExhausted)),
    reraise=True,
)
async def run_ai_enrichment(
    investor_name: str,
    portfolio_companies: list[dict],
    news_signals: list[dict],
    partners: list[dict],
    fund_size: str | None = None,
    stage_focus: str | None = None,
    geo_focus: str | None = None,
) -> dict:
    """Run Vertex AI enrichment pass for an investor.

    Returns structured JSON with conflict mapping, thesis inference,
    and outreach suggestions.
    """
    settings = get_settings()
    if not settings.vertex_project:
        logger.error("No Vertex project configured — cannot run AI enrichment")
        return {"error": "No Vertex project configured"}

    portfolio_list = "\n".join(
        f"- {pc.get('name', 'Unknown')}: {pc.get('description', 'No description')} "
        f"(Category: {pc.get('category', 'Unknown')})"
        for pc in portfolio_companies
    ) or "No portfolio data available."

    news_summary = "\n".join(
        f"- [{s.get('title', 'Untitled')}]({s.get('url', '')}): {s.get('snippet', '')[:200]}"
        for s in (news_signals or [])[:10]
    ) or "No news signals found."

    partners_list = "\n".join(
        f"- {p.get('name', 'Unknown')} — {p.get('title', 'Unknown title')}"
        for p in partners
    ) or "No partner data available."

    user_prompt = USER_PROMPT_TEMPLATE.format(
        investor_name=investor_name,
        portfolio_list=portfolio_list,
        news_summary=news_summary,
        fund_size=fund_size or "Unknown",
        stage_focus=stage_focus or "Unknown",
        geo_focus=geo_focus or "Unknown",
        partners_list=partners_list,
    )

    model = _get_model()

    try:
        response = await model.generate_content_async(
            user_prompt,
            generation_config=GenerationConfig(
                max_output_tokens=4096,
                response_mime_type="application/json",
            ),
        )

        response_text = response.text

        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            if "```" in response_text:
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                if json_start != -1 and json_end > json_start:
                    return json.loads(response_text[json_start:json_end])
            logger.error("Failed to parse Vertex AI response as JSON")
            return {"raw_response": response_text, "parse_error": True}

    except Exception as e:
        logger.error("Vertex AI call failed for %s: %s", investor_name, e)
        raise
