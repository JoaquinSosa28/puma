import type { MetadataRoute } from "next";

// The app itself stays out of search indexes. When a hosted deployment serves
// marketing pages behind the same domain (MARKETING_HOME), those
// public paths are allowed — robots.txt is served from this app either way.
export default function robots(): MetadataRoute.Robots {
  const marketing = process.env.MARKETING_HOME;
  return {
    rules: {
      userAgent: "*",
      allow: marketing ? ["/$", marketing, "/legal/"] : undefined,
      disallow: "/",
    },
  };
}
