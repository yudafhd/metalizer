import { appDataDir, join } from "@tauri-apps/api/path";
import { Client, Stronghold } from "@tauri-apps/plugin-stronghold";
import { preferencesStore } from "./store";

const secretKey = "gemini-api-key";
const clientName = "metadata-generator-secrets";
const vaultSeedKey = "stronghold-vault-seed";

interface VaultContext {
  stronghold: Stronghold;
  client: Client;
}

let contextPromise: Promise<VaultContext> | undefined;

async function vaultContext(): Promise<VaultContext> {
  if (!contextPromise) {
    contextPromise = (async () => {
      let seed = await preferencesStore.get<string>(vaultSeedKey);
      if (!seed) {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        seed = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
        await preferencesStore.set(vaultSeedKey, seed);
        await preferencesStore.save();
      }
      const vaultPath = await join(await appDataDir(), "metadata-generator-vault.hold");
      const stronghold = await Stronghold.load(vaultPath, seed);
      let client: Client;
      try {
        client = await stronghold.loadClient(clientName);
      } catch {
        client = await stronghold.createClient(clientName);
      }
      return { stronghold, client };
    })();
  }
  return contextPromise;
}

export async function readApiKey(): Promise<string | null> {
  if (!("__TAURI_INTERNALS__" in window)) return null;
  const { client } = await vaultContext();
  const data = await client.getStore().get(secretKey);
  if (!data?.length) return null;
  return new TextDecoder().decode(new Uint8Array(data));
}

export async function saveApiKey(value: string): Promise<void> {
  const { stronghold, client } = await vaultContext();
  await client.getStore().insert(secretKey, Array.from(new TextEncoder().encode(value.trim())));
  await stronghold.save();
}

export async function removeApiKey(): Promise<void> {
  const { stronghold, client } = await vaultContext();
  await client.getStore().remove(secretKey);
  await stronghold.save();
}
