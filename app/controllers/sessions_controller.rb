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
    user = User.find_or_create_by(uid: user_info.uid, provider: user_info.provider)
    user.update!(email: user_info.info.email, name: user_info.info.name, image: user_info.info.image)
    # Make first user admin
    user.update!(admin: true) if User.count == 1
    return_to = session[:return_to]
    reset_session
    session[:user_id] = user.id
    redirect_to return_to || my_path
  end
end
