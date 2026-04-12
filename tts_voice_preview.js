require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const textToSpeech = require("@google-cloud/text-to-speech");

async function main() {
  const client = new textToSpeech.TextToSpeechClient();

  const outDir = path.join(__dirname, "tts_previews");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const samples = [
  { label: "q_station", text: "Could you tell me where the station is?" },
  { label: "long_weather", text: "I thought the weather would improve by Thursday." },
  { label: "contraction", text: "I've already told him, but he still doesn't understand." },
  { label: "natural_rhythm", text: "The girl standing near the station is my younger sister." },
  { label: "simple_statement", text: "We have a lot of work this week." },
];

  const voices = [
  { name: "en-GB-Chirp-HD-D", languageCode: "en-GB" },
  { name: "en-GB-Studio-B", languageCode: "en-GB" },
];

  const speakingRate = 1.0;
  const pitch = 0.0;

  for (const voice of voices) {
    console.log(`\n=== TESTING VOICE: ${voice.name} ===`);

    for (const sample of samples) {
      try {
        const [response] = await client.synthesizeSpeech({
          input: { text: sample.text },
          voice: {
            languageCode: voice.languageCode,
            name: voice.name,
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate,
            pitch,
          },
        });

        const filePath = path.join(outDir, `${voice.name}__${sample.label}.mp3`);
        fs.writeFileSync(filePath, response.audioContent, "binary");
        console.log(`✅ Saved: ${filePath}`);
      } catch (err) {
        console.log(`❌ FAILED: voice=${voice.name} sample=${sample.label}`);
        console.log(String(err?.message || err));
      }
    }
  }

  console.log("\nDone. Open the tts_previews folder and compare the files that were created.");
}

main().catch((err) => {
  console.error("Preview generation failed:", err?.message || err);
  process.exit(1);
});
