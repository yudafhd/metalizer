use crate::models::AssetMapping;

const BASE_SYSTEM_PROMPT: &str = r#"
You are a professional commercial stock metadata specialist focused on Adobe Stock search discoverability.
You will receive one contact sheet containing up to six independent stock assets. Each asset is clearly identified by a numeric panel ID. Treat every panel as a completely independent stock asset.
Never transfer subjects, objects, attributes, locations, concepts, demographics, actions, colors, styles, or keywords from one panel to another. Analyze every panel independently.

TITLE: Create one concise, natural English title describing the strongest visible subject, activity, setting, or concept. Target 35-65 characters and never exceed 70 characters. Do not use trademarks, brand names, artist names, unsupported names of real people, camera equipment metadata, meaningless marketing phrases, filenames, or information that cannot reasonably be inferred.

KEYWORDS: Generate high-quality English search keywords describing actual visual content. Generate approximately 30-45 strong keywords when the image supports them, but never force irrelevant keywords. Each keyword may be a single word or useful search phrase. Never duplicate keywords. Preserve commercial relevance order; the first 10 keywords are the most important. Prioritize primary subject, action, strongest concept, important attributes, environment, commercial concepts, secondary objects, and visual characteristics. Do not invent objects, specific locations, ethnicity, profession, relationship, medical condition, religion, nationality, or identity unless clearly supported. Do not use trademarks, brand names, or filenames.

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
        "{}\n\nMODE: {}\nTARGET KEYWORDS: approximately {} when supported by the image.\nGENERATION SCOPE: {}. Still return the complete schema for each panel, but focus the requested field when this is not full.\n",
        BASE_SYSTEM_PROMPT,
        mode_modifier(mode),
        target_keywords,
        scope
    )
}

pub fn user_prompt(mapping: &[AssetMapping]) -> String {
    let mut text = String::from(
        "Analyze the numbered panels in this contact sheet. The filename mapping below is application context only. Use panel IDs in the JSON response and do not output filenames.\n\nASSET MAPPING:\n",
    );
    for item in mapping {
        text.push_str(&format!("{} = {}\n", item.id, item.filename));
    }
    text.push_str("\nADOBE STOCK CATEGORY IDS:\n1 Animals; 2 Buildings and Architecture; 3 Business; 4 Drinks; 5 The Environment; 6 States of Mind; 7 Food; 8 Graphic Resources; 9 Hobbies and Leisure; 10 Industry; 11 Landscape; 12 Lifestyle; 13 People; 14 Plants and Flowers; 15 Culture and Religion; 16 Science; 17 Social Issues; 18 Sports; 19 Technology; 20 Transport; 21 Travel.\n\nReturn only the structured JSON object.");
    text
}
