class FrontpageController < ApplicationController
  layout "frontpage"

  def index
    path = shared_link_path
    return redirect_to path if path

    # screenshot is a file check, so the filter runs in Ruby on a few candidates
    @featured_maps = Map.unscoped.listed.where(tags: "featured").to_a.shuffle.select(&:screenshot).first(3).presence ||
      Map.unscoped.listed.sorted("view_count", "desc").limit(20).to_a.select(&:screenshot).first(3)
    @stats = stats
  end

  private

  def stats
    Rails.cache.fetch("frontpage_stats", expires_in: 1.hour) do
      { maps: Map.count, users: User.count, updated: Rails.root.join("CHANGELOG.md").read[/^## (\S+)/, 1] }
    end
  end

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
