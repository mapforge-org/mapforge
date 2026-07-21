class ApplicationController < ActionController::Base
  before_action :set_user
  before_action :disable_session_cookies
  before_action :set_gettext_locale

  # Rails Bug: Actions that define their own rate limit
  # (see ImagesController) must be excluded from the global one.
  RATE_LIMITED_ACTIONS = %w[icon image osmc_symbol upload].freeze

  rate_limit to: 120, within: 1.minute, name: "global",
    unless: -> { RATE_LIMITED_ACTIONS.include?(action_name) }

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

  def allow_iframe
    response.headers.delete("X-Frame-Options")
  end

  def set_user
    @user = User.find_by(id: session[:user_id]) if session[:user_id]
  end

  def require_login
    redirect_to login_path unless @user
  end

  def disable_session_cookies
    request.session_options[:skip] = true unless @user
  end

  # Overrides gettext_i18n_rails' version. Anonymous users carry locale via
  # the URL param (see default_url_options) instead of a session cookie.
  # Logged-in users get it persisted to their session so links don't need it.
  def set_gettext_locale
    natural_locale = (session[:locale] if @user) || request.env["HTTP_ACCEPT_LANGUAGE"] || I18n.default_locale
    requested_locale = params[:locale] || natural_locale

    implicit_locale = FastGettext.set_locale(natural_locale)
    locale = FastGettext.set_locale(requested_locale)

    # Only append ?locale= for anonymous users when it actually changes what
    # they'd get without it (e.g. an explicit switch away from Accept-Language).
    @append_locale_param = !@user && locale != implicit_locale
    session[:locale] = locale if @user
    I18n.locale = locale
  end

  def default_url_options
    @append_locale_param ? { locale: I18n.locale } : {}
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
        url: docs_url,
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
