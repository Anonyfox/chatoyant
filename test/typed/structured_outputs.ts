import { genData, JsonSchema, Schema } from "chatoyant";

export class Invoice extends Schema {
  vendor = Schema.String();
  total_cents = Schema.Integer();
}

export async function extractInvoice() {
  const invoice = await genData(
    "Extract invoice: Acme charged 1250 cents.",
    Invoice,
    { model: "grok-4.7", maxTokens: 256 },
  );
  const vendor: string = invoice.vendor;
  const totalCents: number = invoice.total_cents;
  console.log(`${vendor}: ${totalCents} cents`);
  return invoice;
}

export function validateInvoiceJson(text: string) {
  const data: unknown = JSON.parse(text);
  return JsonSchema.validate(Schema.toJSON(Invoice), data);
}
