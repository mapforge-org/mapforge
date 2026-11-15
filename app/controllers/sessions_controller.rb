class SessionsController < ApplicationController
  # setting session cookie to enable csrf token
  skip_before_action :disable_session_cookies

  layout "frontpage"

  def new
    # url_from drops foreign hosts, so the param cannot turn the login into an open redirect
    session[:return_to] = url_from(params[:origin])
    render :new
  end

  def logout
    reset_session
    redirect_to root_path
  end

  def developer
    render :developer
  end

  def create
    user_info = request.env["omniauth.auth"]
    return connect_garmin(user_info.credentials) if user_info.provider == "garmin"
    user = User.find_or_create_by(uid: user_info.uid, provider: user_info.provider)
    user.update!(email: user_info.info.email, name: user_info.info.name, image: user_info.info.image)
    # Make first user admin
    user.update!(admin: true) if User.one?
    return_to = session[:return_to]
    reset_session
    session[:user_id] = user.id
    redirect_to return_to || my_path
  end

  private

  def connect_garmin(credentials)
    return redirect_to(login_path) unless @user
    @user.save_garmin_token!(credentials)
    redirect_to url_from(request.env["omniauth.origin"]) || my_path
  end
end
