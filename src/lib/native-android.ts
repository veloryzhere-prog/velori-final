import { Capacitor, registerPlugin } from "@capacitor/core";

type VeloriDevicePlugin = {
  haptic(options: { style: "light" | "selection" }): Promise<{ performed: boolean }>;
  share(options: { title: string; text: string; url: string }): Promise<void>;
  setSystemBars(options: { darkMode: boolean }): Promise<void>;
};

const VeloriDevice = registerPlugin<VeloriDevicePlugin>("VeloriDevice");

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function nativeHaptic(style: "light" | "selection" = "light") {
  if (!isNativeAndroid()) return;
  await VeloriDevice.haptic({ style });
}

export async function shareWithAndroid(title: string, url: string) {
  if (!isNativeAndroid()) return false;
  await VeloriDevice.share({ title, text: url, url });
  return true;
}

export async function setAndroidSystemBars(darkMode: boolean) {
  if (!isNativeAndroid()) return;
  await VeloriDevice.setSystemBars({ darkMode });
}
