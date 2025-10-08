class ApplicationController < ActionController::Base
  before_action :set_user
  before_action :disable_session_cookies

  rate_limit to: 30, within: 1.minute

  rescue_from ActionController::RoutingError, with: :render_not_found

  def sitemap
    # Cache the sitemap for 1 hour
    expires_in 1.hour, public: true

    @maps = Map.listed
    @static_pages = static_pages_data

    respond_to do |format|
      format.xml { render layout: false, content_type: "application/xml" }
    end
  end

  def render_not_found
    render file: Rails.root.join("public", "404.html"), status: :not_found, layout: false
  end

  private

  def set_user
    @user = User.find_by(id: session[:user_id]) if session[:user_id]
  end

  def require_login
    redirect_to login_path unless @user
  end

  def disable_session_cookies
    request.session_options[:skip] = true unless @user
  end

  def static_pages_data
    [
      {
        url: root_url,
        lastmod: @maps.first&.updated_at || Time.current,
        changefreq: "weekly",
        priority: "1.0"
      },
      {
        url: tutorials_url,
        lastmod: Time.current,
        changefreq: "weekly",
        priority: "0.9"
      },
      {
        url: maps_url,
        lastmod: @maps.first&.updated_at || Time.current,
        changefreq: "daily",
        priority: "0.7"
      }
    ]
  end
end
