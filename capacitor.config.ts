import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "online.veloryz.velori",
  appName: "VELORI",
  webDir: process.env.VELORI_CAPACITOR_ANDROID_BUILD === "true" ? ".capacitor-android-web" : "dist",
};

export default config;
