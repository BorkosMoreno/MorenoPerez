export default async function(eleventyConfig) {
  // Copia directa de archivos estáticos sin procesar
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/site.webmanifest");
  eleventyConfig.addPassthroughCopy("src/assets/css");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/assets/favicons");
  eleventyConfig.addPassthroughCopy("src/assets/imagenes");
  eleventyConfig.addPassthroughCopy("src/descargas");
  eleventyConfig.addPassthroughCopy("src/fotografias");

  // Configuración de URLs explícitas con extensión .html
  eleventyConfig.addGlobalData("permalink", () => {
    return "{{ page.filePathStem }}.html";
  });

  // Shortcode para obtener el año actual dinámicamente en el footer
  eleventyConfig.addShortcode("year", () => {
    return new Date().getFullYear().toString();
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};