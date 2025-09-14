xml.instruct! :xml, version: "1.0", encoding: "UTF-8"
xml.urlset xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9" do
  @static_pages.each do |page_data|
    xml.url do
      xml.loc page_data[:url]
      xml.lastmod page_data[:lastmod].iso8601
      xml.changefreq page_data[:changefreq]
      xml.priority page_data[:priority]
    end
  end

  @maps.each do |map|
    xml.url do
      xml.loc map_url(map.public_id, name: map.name)
      xml.lastmod map.updated_at.iso8601
      xml.changefreq "monthly"
      xml.priority "0.6"
    end
  end
end
