use crate::models::AssetMapping;

const BASE_SYSTEM_PROMPT: &str = r#"
You are a professional commercial stock metadata specialist focused on Adobe Stock search discoverability.
You will receive one contact sheet containing up to six independent stock assets. Each asset is clearly identified by a numeric panel ID. Treat every panel as a completely independent stock asset.
Never transfer subjects, objects, attributes, locations, concepts, demographics, actions, colors, styles, or keywords from one panel to another. Analyze every panel independently.

STILL IMAGES & VIDEO STORYBOARDS:
- When a panel contains a single image/vector/illustration, analyze it as a still stock asset.
- When a panel contains a multi-frame storyboard sequence (marked [VIDEO] or displaying time-progressing frames), it represents a commercial stock video/footage asset. Analyze the temporal progression, dynamic action, subject movement, and camera movement across the frames.

TITLE: Create one concise, natural English title of approximately 5-10 words describing what the asset is, its visible style, and what is happening. For video assets, describe the active motion, subject, and scene (e.g. "Slow Motion of Cyclist Riding Along Mountain Trail at Sunset"). Target 35-65 characters and never exceed 70 characters. Write a readable short phrase, not a keyword list. Do not use trademarks, brand names, artist names, unsupported names of real people, camera equipment metadata, meaningless marketing phrases, filenames, or information that cannot reasonably be inferred.

KEYWORDS: Generate relevant English search keywords, usually 15-35 when the asset supports that many. Treat the requested count as a target, not a quota; return fewer rather than inventing or padding terms. Each keyword may be a single word or a useful search phrase. Never duplicate keywords or waste positions on trivial plural or synonym variations.
Build candidates from four evidence-based layers, without fixed quotas:
1. Literal: the visible subject, objects, distinguishing attributes, and primary actions.
2. Contextual: supported setting, time, interactions, and circumstances.
3. Conceptual and emotional: themes or moods genuinely conveyed by the asset, not imagined buyer uses.
4. Visual style: supported viewpoint, lighting, composition, and medium. For video, include camera movement or pacing only when the storyboard shows it; for still images, include terms such as illustration, vector, isolated, or flat lay only when visible.
Order the final keywords by relevance to this individual asset, most important first. The first 10 should contain the main subject and action, plus any setting or concept central to the asset. Include important content words and concepts from the title among the first 10 when accurate. Do not reserve the first 10 exclusively for literal terms, and do not alphabetize the list.
Do not invent objects, specific locations, ethnicity, profession, relationship, medical condition, religion, nationality, or identity unless clearly supported.
Never use trademarks, brand names, artist names, logos, product names, camera brand names (e.g. Sony, Canon), filenames, or spam terms such as best, amazing, beautiful, trending, viral, premium, hd, or 4k.

CATEGORY: Choose exactly one Adobe Stock category ID from the provided category list.

OUTPUT: Return exactly one metadata object for each supplied panel ID. Never change panel IDs, omit an asset, or create an additional asset. Return structured JSON only. Do not return Markdown, CSV, explanations, or prose.
"#;

fn mode_modifier(mode: &str) -> &'static str {
    match mode {
        "strict" => "Use a strict interpretation: include only subjects, actions, attributes, and concepts that are clearly visible or strongly supported.",
        "discovery" => "Use a discovery-oriented interpretation: include a few broader buyer search concepts when they remain directly relevant to the visible content. Never keyword spam.",
        _ => "Use a balanced interpretation: combine clearly visible subjects, actions, setting, and relevant commercial concepts.",
    }
}

pub fn system_prompt(mode: &str, target_keywords: u8, scope: &str) -> String {
    format!(
        "{}\n\nMODE: {}\nTARGET KEYWORDS: Aim for {} relevant keywords, within the usual 15-35 range when supported. Stop early when further terms would be generic, repetitive, or uncertain.\nGENERATION SCOPE: {}. Still return the complete schema for each panel, but focus the requested field when this is not full.\n",
        BASE_SYSTEM_PROMPT,
        mode_modifier(mode),
        target_keywords,
        scope
    )
}

pub fn user_prompt(mapping: &[AssetMapping], additional_prompt: &str, scope: &str) -> String {
    let mut text = String::from(
        "Analyze the numbered panels in this contact sheet. The filename mapping below is application context only. Use panel IDs in the JSON response and do not output filenames.\n\nASSET MAPPING:\n",
    );
    for item in mapping {
        text.push_str(&format!("{} = {}\n", item.id, item.filename));
        if scope == "keywords" {
            if let Some(title) = item.existing_title.as_deref().filter(|title| !title.trim().is_empty()) {
                text.push_str(&format!("Existing title for panel {}: {}\n", item.id, title.trim()));
            }
        }
    }
    if scope == "keywords" {
        text.push_str("\nFor keyword regeneration, preserve the existing title shown above. Make the most important relevant title concepts discoverable among the first 10 keywords.\n");
    }
    if !additional_prompt.trim().is_empty() {
        text.push_str("\nUSER-PROVIDED CONTEXT:\n");
        text.push_str(additional_prompt.trim());
        text.push_str("\nUse this as additional context for the supplied asset(s) when relevant. It may describe a theme, event, or intended subject, but do not add unrelated claims or contradict what is visible.\n");
    }
    text.push_str("\nADOBE STOCK CATEGORY IDS:\n1 Animals; 2 Buildings and Architecture; 3 Business; 4 Drinks; 5 The Environment; 6 States of Mind; 7 Food; 8 Graphic Resources; 9 Hobbies and Leisure; 10 Industry; 11 Landscape; 12 Lifestyle; 13 People; 14 Plants and Flowers; 15 Culture and Religion; 16 Science; 17 Social Issues; 18 Sports; 19 Technology; 20 Transport; 21 Travel.\n\nReturn only the structured JSON object.");
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_context_is_added_only_when_provided() {
        let mapping = vec![AssetMapping {
            id: "01".to_string(),
            filename: "marine-day.svg".to_string(),
            existing_title: None,
        }];
        let prompt = user_prompt(&mapping, "This is Japanese Marine Day.", "full");
        assert!(prompt.contains("USER-PROVIDED CONTEXT:"));
        assert!(prompt.contains("This is Japanese Marine Day."));
        assert!(!user_prompt(&mapping, "  ", "full").contains("USER-PROVIDED CONTEXT:"));
    }
}
