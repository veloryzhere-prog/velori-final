import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { informationPages, informationFooterLinks, extraInformationSlugs } from "./catalog.ts";
import { buildMoreLinkGroups } from "./more-page-policy.mjs";
import {
  companyNavigation,
  companyPathForRoute,
} from "../../components/company/companyNavigation.ts";

test("hosting sends direct client-route visits through the SPA entrypoint", async () => {
  const redirects = await readFile(new URL("../../../public/_redirects", import.meta.url), "utf8");
  assert.match(redirects, /^\/\*\s+\/index\.html\s+200\s*$/m);
});

test("footer destinations have unique internal pages and accurate external resources", () => {
  assert.equal(
    new Set(informationFooterLinks.map(([, to]) => to)).size,
    informationFooterLinks.length,
  );
  for (const [, to] of informationFooterLinks) {
    if (to === "/help" || to === "/forge") continue;
    const page = informationPages[to.slice(1)];
    assert.ok(page, `missing ${to}`);
    assert.ok(page.sections.length >= 3, `incomplete ${to}`);
    for (const a of page.actions)
      assert.ok(a.to.startsWith("/") || a.to.startsWith("https://") || a.to.startsWith("@"));
  }
  for (const slug of extraInformationSlugs) assert.ok(informationPages[slug]);
  assert.equal(informationPages["meta-ai"], undefined);
  assert.equal(informationPages.threads, undefined);
  assert.equal(informationPages.muse, undefined);
  assert.match(informationPages["veloryz-ai"].intro, /under construction/);
  assert.match(informationPages.jobs.sections[0].text, /no active vacancies/);
  assert.match(
    informationPages.verified.sections.map((s) => s.text).join(" "),
    /does not collect payments/,
  );
});

test("company hub owns CMS routes and no footer exposes a second CMS link directory", async () => {
  const registeredRoutes = new Set([
    ...extraInformationSlugs.map((slug) => `/${slug}`),
    "/about",
    "/help",
    "/privacy",
    "/terms",
    "/contact",
    "/safety",
    "/community-guidelines",
    "/cookies",
    "/acceptable-use",
    "/data-policy",
    "/legal",
  ]);
  const companyItems = companyNavigation.flatMap((group) => group.items);
  const routes = await readFile(new URL("../../app/routes.tsx", import.meta.url), "utf8");
  const footerSource = await readFile(new URL("./InformationPage.tsx", import.meta.url), "utf8");
  const welcome = await readFile(
    new URL("../../product/WelcomeScreen.tsx", import.meta.url),
    "utf8",
  );
  const shell = await readFile(new URL("../../app/shell.tsx", import.meta.url), "utf8");

  assert.equal(new Set(companyItems.map((item) => item.slug)).size, companyItems.length);
  for (const item of companyItems) {
    assert.equal(item.path, item.slug === "forge" ? "/forge" : `/us#${item.slug}`);
    assert.equal(companyPathForRoute(item.legacyPath), item.path);
    if (item.slug === "forge") {
      assert.match(routes, /path:\s*"forge"/);
      continue;
    }
    assert.ok(
      registeredRoutes.has(item.legacyPath),
      `company hub links to missing route ${item.legacyPath}`,
    );
  }
  assert.equal(companyPathForRoute("/directory"), "/us#about");
  assert.equal(companyPathForRoute("/forge"), "/forge");
  assert.equal(companyPathForRoute("/us#forge"), "/forge");
  assert.match(routes, /path:\s*"us"[\s\S]*?components\/company\/CompanyHub/);
  assert.match(
    routes,
    /path:\s*slug,[\s\S]*?to=\{slug === "directory" \? "\/us#about" : `\/us#\$\{slug\}`\}/,
  );
  assert.match(routes, /\{ path:\s*"help", element:\s*<Navigate to="\/us#help" replace \/> \}/);
  assert.doesNotMatch(footerSource, /export function InformationFooter/);
  assert.doesNotMatch(welcome, /InformationFooter/);
  assert.doesNotMatch(shell, /InformationFooter/);
  const cmsPage = await readFile(new URL("../../app/cms-public-page.tsx", import.meta.url), "utf8");
  assert.match(cmsPage, /navigate\(companyPathForRoute\(targetRoute\)\)/);
});

test("More groups every footer destination and adds working account settings", () => {
  const sections = buildMoreLinkGroups(informationFooterLinks);
  const groupedLinks = sections.flatMap((section) => section.links);
  const groupedRoutes = new Set(groupedLinks.map(([, route]) => route));

  for (const [, route] of informationFooterLinks) {
    assert.ok(groupedRoutes.has(route), `More is missing the existing footer route ${route}`);
  }
  for (const route of [
    "/settings",
    "/settings/account",
    "/settings/appearance",
    "/settings/privacy",
    "/settings/notifications",
  ]) {
    assert.ok(groupedRoutes.has(route), `More is missing the account destination ${route}`);
  }
  assert.ok(sections.some((section) => section.id === "support" && section.links.length > 0));
  assert.ok(sections.some((section) => section.id === "legal" && section.links.length > 0));
  assert.equal(groupedLinks.filter(([, route]) => route === "/terms").length, 1);
});

test("More has a direct application route and a primary mobile navigation destination", async () => {
  const routes = await readFile(new URL("../../app/routes.tsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../../app/shell.tsx", import.meta.url), "utf8");
  const frame = await readFile(new URL("../../product/ProductFrame.tsx", import.meta.url), "utf8");

  assert.match(routes, /path:\s*"more"[\s\S]*?import\("\.\/more-page"\)/);
  assert.match(shell, /to:\s*"\/more",\s*text:\s*"More"/);
  assert.match(shell, /"\/more",\s*\]\s*;/);
  assert.match(frame, /"\/home",\s*"\/explore",\s*"\/messages",\s*"\/more"/);
  assert.match(shell, /"\/more",\s*\n\];/);
});

test("OS reduced-motion CSS cannot silently override an explicit Full selection", async () => {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
      if (entry.isDirectory()) await walk(url);
      else if (entry.name.endsWith(".css")) files.push(url);
    }
  }
  await walk(new URL("../../", import.meta.url));
  let checked = 0;
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const marker = "@media (prefers-reduced-motion: reduce)";
    let start = 0;
    while ((start = source.indexOf(marker, start)) !== -1) {
      const open = source.indexOf("{", start);
      let end = open + 1,
        depth = 1;
      for (; end < source.length && depth; end++) {
        if (source[end] === "{") depth++;
        if (source[end] === "}") depth--;
      }
      const block = source.slice(open + 1, end - 1);
      for (const rule of block.split("}")) {
        if (!rule.includes("{")) continue;
        const selector = rule.slice(0, rule.indexOf("{"));
        assert.match(
          selector,
          /:not\(\[data-ui-motion="full"\]\)/,
          `${file.pathname}: ${selector}`,
        );
      }
      checked++;
      start = end;
    }
  }
  assert.ok(checked >= 30);
});
