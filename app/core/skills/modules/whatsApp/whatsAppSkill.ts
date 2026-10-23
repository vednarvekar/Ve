import type { BaseSkill, SkillContext, SkillResult, SkillValidationResult } from "../../contracts/skillTypes.js";
import { buildWhatsAppChatUrl } from "../../../browser/siteUrls.js";
import { BrowserSkill } from "../browser/browserSkill.js";

export interface WhatsAppParams {
  recipientName?: string | undefined;
  phone?: string | undefined;
  message: string;
}

function normalizeContactName(value: string) {
  return value.toLowerCase().replace(/^(my\s+)?(friend\s+)?/, "").replace(/\s+/g, " ").trim();
}

export class WhatsAppSkill implements BaseSkill<WhatsAppParams> {
  readonly id = "whatsApp";
  readonly name = "WhatsApp Message";
  readonly description = "Prepares a WhatsApp message for a contact or phone number";
  readonly riskLevel = 2;

  private browserSkill = new BrowserSkill();

  validate(params: unknown): SkillValidationResult<WhatsAppParams> {
    if (!params || typeof params !== "object") {
      return { valid: false, error: "Parameters must contain message details." };
    }
    const p = params as Record<string, unknown>;
    const message = typeof p.message === "string" ? p.message.trim() : "";
    const recipientName = typeof p.recipientName === "string" ? p.recipientName.trim() : undefined;
    const phone = typeof p.phone === "string" ? p.phone.trim() : undefined;

    if (!message) {
      return { valid: false, error: "What message should I prepare?" };
    }
    if (!recipientName && !phone) {
      return { valid: false, error: "Recipient name or phone number must be provided." };
    }
    return { valid: true, data: { recipientName, phone, message } };
  }

  async execute(params: WhatsAppParams, context: SkillContext): Promise<SkillResult> {
    let targetPhone = params.phone;
    let displayName = params.recipientName || params.phone || "the recipient";

    if (!targetPhone && params.recipientName) {
      const normalizedQuery = normalizeContactName(params.recipientName);
      let contacts: Array<{ name: string; phone: string }> = [];

      if (context.contactsProvider) {
        contacts = await context.contactsProvider();
      } else {
        try {
          const service = await import("../../../../main/assistantService.js").catch(() => null);
          if (service?.listContacts) {
            contacts = await service.listContacts();
          }
        } catch {
          // In test environments without assistantService
        }
      }

      const match = contacts.find((item) => normalizeContactName(item.name) === normalizedQuery);
      if (!match) {
        return {
          success: false,
          message: `I don’t have a saved WhatsApp number for “${params.recipientName}”. Add the contact under Contacts (including country code), then try again.`,
        };
      }
      targetPhone = match.phone;
      displayName = match.name;
    }

    if (!targetPhone) {
      return { success: false, message: "A valid phone number is required to open WhatsApp chat." };
    }

    const webUrl = buildWhatsAppChatUrl(targetPhone, params.message);
    const browserResult = await this.browserSkill.execute({ action: "navigate", url: webUrl }, context);

    if (browserResult.success) {
      return {
        success: true,
        message: `Opened WhatsApp Web for ${displayName} with your message prefilled. Verify the recipient and click Send in WhatsApp.`,
        behaviorAction: "whatsapp_message",
      };
    }

    return {
      success: false,
      message: `Could not open WhatsApp Web: ${browserResult.message}`,
    };
  }
}
