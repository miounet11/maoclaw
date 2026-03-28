//! Built-in system templates for V2.
//!
//! Templates provide scenario-first entry: users choose a work system by
//! what they want to accomplish, not by configuring blank agents.
//!
//! Each template defines:
//! - a canonical `template_type` id
//! - display metadata (name, category, short description, deliverables)
//! - a default [`TeamBlueprint`] with appropriate roles
//! - a default [`MemoryStrategy`]
//! - a `result_schema` id for artifact generation
//!
//! # V2 launch catalog
//!
//! 1. `website_development`  — Website Development System
//! 2. `project_development`  — Project Development System
//! 3. `content_growth`       — Content Growth System
//! 4. `one_person_company`   — One-Person Company System
//! 5. `sales_development`    — Sales Development System
//! 6. `legal_documents`      — Legal Document System
//! 7. `financial_research`   — Financial Research System
//! 8. `custom`               — Custom / blank system

use crate::system_profile::{
    AgentRole, MemoryBucket, MemoryBucketKind, MemoryStrategy, ROLE_COORDINATOR, ROLE_IMPLEMENTER,
    ROLE_OPERATOR, ROLE_PLANNER, ROLE_RESEARCHER, ROLE_REVIEWER, ROLE_WRITER, SystemProfile,
    TeamBlueprint,
};

// ── Template metadata ─────────────────────────────────────────────────────────

/// Entry-layer category for the V2 home surface.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TemplateCategory {
    Build,
    Grow,
    Operate,
    Research,
    Create,
}

impl TemplateCategory {
    pub const fn label(&self) -> &'static str {
        match self {
            Self::Build => "Build",
            Self::Grow => "Grow",
            Self::Operate => "Operate",
            Self::Research => "Research",
            Self::Create => "Create",
        }
    }
}

/// Static descriptor for a built-in template.
pub struct Template {
    /// Canonical id stored in `SystemProfile::template_type`.
    pub id: &'static str,
    /// Display name shown in template picker.
    pub name: &'static str,
    pub category: TemplateCategory,
    /// One-line description for the picker card.
    pub tagline: &'static str,
    /// Bullet list of deliverables (V2 spec § 8).
    pub deliverables: &'static [&'static str],
    /// Role ids that make up the default team blueprint.
    pub roles: &'static [&'static str],
    /// Result schema id used for artifact generation.
    pub result_schema: &'static str,
}

/// All built-in templates in display order.
pub fn all_templates() -> &'static [Template] {
    TEMPLATES
}

/// Find a template by id.
pub fn find_template(id: &str) -> Option<&'static Template> {
    TEMPLATES.iter().find(|t| t.id == id)
}

/// Build a ready-to-use `SystemProfile` from a template.
///
/// The returned profile has a proper id, name, blueprint, and memory
/// strategy pre-filled.  Provider/model are left as `None` and resolved
/// from the active config at runtime.
pub fn instantiate(template_id: &str, system_name: Option<&str>) -> SystemProfile {
    let tmpl = find_template(template_id).unwrap_or(&TEMPLATES[CUSTOM_IDX]);

    let name = system_name
        .filter(|s| !s.is_empty())
        .unwrap_or(tmpl.name)
        .to_string();

    let blueprint = build_blueprint(tmpl);
    let memory = build_memory(tmpl);

    SystemProfile {
        name,
        template_type: tmpl.id.to_string(),
        team_blueprint: Some(blueprint),
        memory_strategy: memory,
        result_schema: Some(tmpl.result_schema.to_string()),
        description: Some(tmpl.tagline.to_string()),
        ..SystemProfile::default()
    }
}

// ── Private builders ──────────────────────────────────────────────────────────

fn build_blueprint(tmpl: &Template) -> TeamBlueprint {
    let roles: Vec<AgentRole> = tmpl.roles.iter().map(|&rid| role_def(rid)).collect();
    TeamBlueprint::new(format!("{}_team", tmpl.id), roles)
}

fn build_memory(tmpl: &Template) -> MemoryStrategy {
    use MemoryBucketKind::{
        BrandStyle, ChannelContext, ProjectMemory, ResultHistory, SystemRules, ToolUsage,
        UserProfile,
    };
    // All systems get the standard buckets, with brand/style enabled for
    // content-heavy templates.
    let brand_enabled = matches!(
        tmpl.id,
        "website_development" | "content_growth" | "sales_development"
    );
    MemoryStrategy {
        buckets: vec![
            MemoryBucket::new(UserProfile, true),
            MemoryBucket::new(ProjectMemory, true),
            MemoryBucket::new(SystemRules, true),
            MemoryBucket::new(ToolUsage, false),
            MemoryBucket::new(ResultHistory, true),
            MemoryBucket::new(BrandStyle, brand_enabled),
            MemoryBucket::new(ChannelContext, false),
        ],
    }
}

fn role_def(id: &str) -> AgentRole {
    match id {
        ROLE_PLANNER => AgentRole::new(
            ROLE_PLANNER,
            "Planner",
            "Breaks goals into structured tasks",
        ),
        ROLE_RESEARCHER => AgentRole::new(
            ROLE_RESEARCHER,
            "Researcher",
            "Finds and synthesises information",
        ),
        ROLE_WRITER => AgentRole::new(
            ROLE_WRITER,
            "Writer",
            "Drafts and refines written deliverables",
        ),
        ROLE_IMPLEMENTER => AgentRole::new(
            ROLE_IMPLEMENTER,
            "Implementer",
            "Builds and ships the actual output",
        ),
        ROLE_REVIEWER => AgentRole::new(
            ROLE_REVIEWER,
            "Reviewer",
            "Quality-checks against acceptance criteria",
        ),
        ROLE_OPERATOR => AgentRole::new(
            ROLE_OPERATOR,
            "Operator",
            "Executes actions in connected systems",
        ),
        ROLE_COORDINATOR => AgentRole::new(
            ROLE_COORDINATOR,
            "Coordinator",
            "Manages handoffs between roles",
        ),
        other => AgentRole::new(other, other, ""),
    }
}

// ── Catalog ───────────────────────────────────────────────────────────────────

const CUSTOM_IDX: usize = 7;

static TEMPLATES: &[Template] = &[
    Template {
        id: "website_development",
        name: "Website Development",
        category: TemplateCategory::Build,
        tagline: "For founders, studios, agencies, and product teams.",
        deliverables: &[
            "Site positioning",
            "Information architecture",
            "Page copy",
            "Design brief",
            "Implementation plan",
            "SEO plan",
            "CMS structure",
            "Deployment checklist",
        ],
        roles: &[
            ROLE_PLANNER,
            ROLE_RESEARCHER,
            ROLE_WRITER,
            ROLE_IMPLEMENTER,
            ROLE_REVIEWER,
        ],
        result_schema: "website_delivery",
    },
    Template {
        id: "project_development",
        name: "Project Development",
        category: TemplateCategory::Build,
        tagline: "For software projects end-to-end.",
        deliverables: &[
            "PRD",
            "Architecture",
            "Task breakdown",
            "Implementation output",
            "Tests",
            "Release notes",
        ],
        roles: &[
            ROLE_PLANNER,
            ROLE_RESEARCHER,
            ROLE_IMPLEMENTER,
            ROLE_REVIEWER,
            ROLE_COORDINATOR,
        ],
        result_schema: "project_delivery",
    },
    Template {
        id: "content_growth",
        name: "Content Growth",
        category: TemplateCategory::Grow,
        tagline: "For creators and brands building content at scale.",
        deliverables: &[
            "Topic research",
            "Content plan",
            "Platform-specific copy",
            "Scripts",
            "Calendars",
            "Repurposing packs",
        ],
        roles: &[ROLE_RESEARCHER, ROLE_WRITER, ROLE_REVIEWER, ROLE_OPERATOR],
        result_schema: "content_package",
    },
    Template {
        id: "one_person_company",
        name: "One-Person Company",
        category: TemplateCategory::Operate,
        tagline: "For solo founders running every function.",
        deliverables: &[
            "Market analysis",
            "Content ops",
            "Customer follow-up",
            "Email workflows",
            "Weekly business reviews",
        ],
        roles: &[ROLE_PLANNER, ROLE_RESEARCHER, ROLE_WRITER, ROLE_OPERATOR],
        result_schema: "solofounder_ops",
    },
    Template {
        id: "sales_development",
        name: "Sales Development",
        category: TemplateCategory::Grow,
        tagline: "For pipeline and outreach teams.",
        deliverables: &[
            "Lead research",
            "Outreach sequences",
            "Follow-up drafts",
            "CRM-ready notes",
            "Meeting summaries",
        ],
        roles: &[
            ROLE_RESEARCHER,
            ROLE_WRITER,
            ROLE_OPERATOR,
            ROLE_COORDINATOR,
        ],
        result_schema: "sales_package",
    },
    Template {
        id: "legal_documents",
        name: "Legal Documents",
        category: TemplateCategory::Operate,
        tagline: "For SMEs and founders who need structured legal drafts.",
        deliverables: &[
            "Agreement drafts",
            "Clause comparisons",
            "Risk checklists",
            "Redline guidance",
        ],
        roles: &[ROLE_RESEARCHER, ROLE_WRITER, ROLE_REVIEWER],
        result_schema: "legal_package",
    },
    Template {
        id: "financial_research",
        name: "Financial Research",
        category: TemplateCategory::Research,
        tagline: "For research-heavy users analysing markets and companies.",
        deliverables: &[
            "Earnings summaries",
            "Competitor comparisons",
            "Industry briefs",
            "Risk memos",
        ],
        roles: &[ROLE_RESEARCHER, ROLE_REVIEWER, ROLE_WRITER],
        result_schema: "research_brief",
    },
    Template {
        id: "custom",
        name: "Custom",
        category: TemplateCategory::Build,
        tagline: "Start blank and build your own system.",
        deliverables: &[],
        roles: &[ROLE_PLANNER],
        result_schema: "custom",
    },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_templates_have_unique_ids() {
        let ids: Vec<_> = all_templates().iter().map(|t| t.id).collect();
        let mut dedup = ids.clone();
        dedup.dedup();
        assert_eq!(ids.len(), dedup.len());
    }

    #[test]
    fn instantiate_fills_team_blueprint() {
        let sp = instantiate("website_development", Some("ACME Site"));
        assert_eq!(sp.name, "ACME Site");
        assert_eq!(sp.template_type, "website_development");
        let bp = sp.team_blueprint.unwrap();
        assert!(bp.roles.len() >= 4);
    }

    #[test]
    fn instantiate_custom_uses_fallback_name() {
        let sp = instantiate("custom", None);
        assert_eq!(sp.name, "Custom");
    }

    #[test]
    fn find_nonexistent_template_returns_none() {
        assert!(find_template("does_not_exist").is_none());
    }

    #[test]
    fn content_growth_enables_brand_memory() {
        use crate::system_profile::MemoryBucketKind;

        let sp = instantiate("content_growth", None);
        let brand = sp
            .memory_strategy
            .buckets
            .iter()
            .find(|b| b.kind == MemoryBucketKind::BrandStyle);
        assert!(brand.is_some_and(|b| b.enabled));
    }

    #[test]
    fn website_development_has_result_schema() {
        let sp = instantiate("website_development", None);
        assert_eq!(sp.result_schema.as_deref(), Some("website_delivery"));
    }
}
