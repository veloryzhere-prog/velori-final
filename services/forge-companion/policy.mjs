/* Copyright © 2026 VELORYZ. */
import { existsSync } from "node:fs";
import path from "node:path";

export function dockerExecutable(
  env = process.env,
  platform = process.platform,
  exists = existsSync,
) {
  const windows = platform === "win32";
  const pathApi = windows ? path.win32 : path;
  const executableName = windows ? "docker.exe" : "docker";
  const candidates = (env.PATH ?? "")
    .split(windows ? ";" : path.delimiter)
    .filter(Boolean)
    .map((directory) => pathApi.join(directory, executableName));
  if (windows) {
    if (env.LOCALAPPDATA)
      candidates.push(
        path.win32.join(
          env.LOCALAPPDATA,
          "Programs",
          "DockerDesktop",
          "resources",
          "bin",
          executableName,
        ),
      );
    if (env.ProgramFiles)
      candidates.push(
        path.win32.join(env.ProgramFiles, "Docker", "Docker", "resources", "bin", executableName),
      );
  }
  return candidates.find((candidate) => exists(candidate)) ?? executableName;
}

export function imageReference(value) {
  if (typeof value !== "string" || !/^[a-z0-9./:_-]+@sha256:[a-f0-9]{64}$/.test(value))
    throw Error(
      "Configure a reviewed image pinned by SHA-256 digest. Automatic image pulls are disabled.",
    );
  return value;
}
export function isolationArgs(image, name, network = "none") {
  if (!/^velori-[a-f0-9]{24}$/.test(name) || !["none", "bridge"].includes(network))
    throw Error("Invalid sandbox parameters.");
  return [
    "run",
    "--detach",
    "--rm",
    "--name",
    name,
    "--pull=never",
    "--read-only",
    "--user",
    "1000:1000",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=128",
    "--memory=512m",
    "--cpus=1",
    "--network",
    network,
    "--tmpfs",
    "/workspace:rw,nosuid,nodev,size=256m,uid=1000,gid=1000",
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,size=64m,uid=1000,gid=1000",
    "--workdir",
    "/workspace",
    "--env",
    "HOME=/tmp",
    "--env",
    "npm_config_cache=/tmp/npm",
    "--env",
    "npm_config_ignore_scripts=true",
    "--env",
    "YARN_IGNORE_SCRIPTS=1",
    imageReference(image),
    "sleep",
    "300",
  ];
}
export function requestAllowed({ host, origin, authorization }, originAllowed, token) {
  return (
    /^127\.0\.0\.1:[0-9]+$/.test(host ?? "") &&
    origin === originAllowed &&
    authorization === `Bearer ${token}`
  );
}
export function archive(files) {
  // USTAR regular files only: no link entries or metadata provided by project code.
  const records = [];
  for (const file of files) {
    const data = Buffer.from(file.content),
      header = Buffer.alloc(512);
    if (Buffer.byteLength(file.path) > 100)
      throw Error("Companion paths must be at most 100 bytes.");
    header.write(file.path, 0, 100);
    header.write("0000644\0", 100, 8);
    header.write("0001750\0", 108, 8);
    header.write("0001750\0", 116, 8);
    header.write(data.length.toString(8).padStart(11, "0") + "\0", 124, 12);
    header.write("00000000000\0", 136, 12);
    header.fill(32, 148, 156);
    header[156] = 48;
    header.write("ustar\0", 257, 6);
    header.write("00", 263, 2);
    let sum = 0;
    for (const byte of header) sum += byte;
    header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
    records.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  return Buffer.concat([...records, Buffer.alloc(1024)]);
}
