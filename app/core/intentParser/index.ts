import { SkillName, ParsedIntent } from "../schema/commandSchema";
import { RawParsedIntent } from "./cloudClient";

const KNOWN_SKILL: SkillName[] = ["openApp", "openUrl", "webSearch"];

function isKnownSkill(value: unknown): value is SkillName {
    return typeof value == "string" && (KNOWN_SKILL as string[]).includes(value);
}

function validate(raw: RawParsedIntent): ParsedIntent | null {
    if(raw.type === "command") {
        if(!isKnownSkill(raw.skill) || !raw.params) return null;
        return { type: "command", command: { skill: raw.skill, params: raw.params } };
    }

    if(raw.type === "clarify") {
        if(!raw.question) return null;
        return { type: "clarify", question: raw.question }
    }

    if(raw.type === "unknown"){
        return { type: "unknown" }
    }

    return null;
} 