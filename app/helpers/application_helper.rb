module ApplicationHelper
  def avatar_url(base_url, size)
    uri = URI(base_url)
    params = URI.decode_www_form(uri.query.to_s)
    params.reject! { |k, _| k == "s" }
    params << [ "s", size.to_s ]
    uri.query = URI.encode_www_form(params)
    uri.to_s
  end
end
