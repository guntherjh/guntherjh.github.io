# Eleventy + GitHub Actions over Jekyll's native build

GitHub Pages builds Jekyll natively with zero CI config, which is the path of least resistance for a Pages site. We chose Eleventy with Nunjucks templates instead, deployed via a GitHub Actions workflow (Pages source set to "GitHub Actions," not "Deploy from a branch"). This avoids the Ruby/Jekyll toolchain in favor of the JS ecosystem, at the cost of maintaining a small Actions workflow instead of relying on Pages' built-in build.
