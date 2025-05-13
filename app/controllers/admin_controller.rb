class AdminController < ApplicationController
  before_action :require_admin_user

  def index
    @maps = Map.unscoped.includes(:layers, :user).order(updated_at: :desc)
  end

  private

  def require_admin_user
    redirect_to login_path unless @user&.admin?
  end
end
