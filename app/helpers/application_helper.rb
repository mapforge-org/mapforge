module ApplicationHelper
  # Loads the compiled JS translations for the current locale
  # plus the gettext.js runtime. The locale file is
  # skipped when it doesn't exist yet (e.g. "en", which has no locale/en/app.po).
  def gettext_javascript_tags
    tags = []
    locale_asset = "locale/#{I18n.locale}/app"
    if File.exist?(Rails.root.join("app/assets/javascripts/#{locale_asset}.js"))
      tags << javascript_include_tag(locale_asset, "data-turbo-track": "reload")
    end
    tags << javascript_include_tag("gettext/all", "data-turbo-track": "reload")
    safe_join(tags, "\n")
  end

  def owned_maps_count
    @owned_maps_count ||= @user&.owned_maps&.count || 0
  end

  def avatar_url(base_url, size)
    uri = URI(base_url)
    params = URI.decode_www_form(uri.query.to_s)
    params.reject! { |k, _| k == "s" }
    params << [ "s", size.to_s ]
    uri.query = URI.encode_www_form(params)
    uri.to_s
  end
end
