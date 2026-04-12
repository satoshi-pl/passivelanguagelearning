require("dotenv").config({ path: ".env.local" });

const textToSpeech = require("@google-cloud/text-to-speech");

async function main() {
  const client = new textToSpeech.TextToSpeechClient();

  const [result] = await client.listVoices({});
  const voices = result.voices || [];

  const enGB = voices.filter(
    (v) => (v.languageCodes || []).includes("en-GB")
  );

  const male = enGB.filter(
    (v) => String(v.ssmlGender || "").toUpperCase() === "MALE"
  );

  console.log("Total voices:", voices.length);
  console.log("British English voices:", enGB.length);
  console.log("\nMALE:\n" + male.map(v => `${v.name} — ${v.ssmlGender}`).join("\n"));
}

main().catch((err) => {
  console.error("TTS test failed:", err?.message || err);
  process.exit(1);
});