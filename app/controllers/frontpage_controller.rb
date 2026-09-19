class FrontpageController < ApplicationController
  layout "frontpage"

  def index
    path = shared_link_path
    return redirect_to path if path

    # screenshot is a file check, so the filter runs in Ruby on a few candidates
    @featured_maps = Map.unscoped.listed.sorted("view_count", "desc").limit(20).to_a.select(&:screenshot).first(3)
  end

  private

  # Android has no URL field in its share system, so the shared link arrives in
  # any of the three params that share_target declares in manifest.json.
  def shared_link_path
    link = [ params[:url], params[:text], params[:title] ].compact.join(" ")[%r{https?://\S+}]
    return if link.blank?

    uri = URI.parse(link)
    # A path of "//host" is a protocol relative URL and points at another site.
    # Demand one slash and one more character, so only our own paths pass.
    return unless uri.host == request.host && uri.path.to_s.match?(%r{\A/[^/]})

    uri.request_uri
  rescue URI::Error
    nil
  end
end
