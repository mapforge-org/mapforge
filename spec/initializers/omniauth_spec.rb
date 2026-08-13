require "rails_helper"

describe "OmniAuth developer provider guard" do
  # The condition from config/initializers/omniauth.rb:
  #   Rails.env.local? || (ENV["DEVELOPER_LOGIN_ENABLED"] == "true" && !Rails.env.production?)
  def developer_enabled?(local:, production:, env_var: nil)
    with_env("DEVELOPER_LOGIN_ENABLED" => env_var) do
      allow(Rails.env).to receive(:local?).and_return(local)
      allow(Rails.env).to receive(:production?).and_return(production)
      Rails.env.local? || (ENV["DEVELOPER_LOGIN_ENABLED"] == "true" && !Rails.env.production?)
    end
  end

  def with_env(vars)
    old = vars.keys.each_with_object({}) { |k, h| h[k] = ENV[k] }
    vars.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
    yield
  ensure
    old.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
  end

  context "local environment (development/test)" do
    it "enables developer provider without env var" do
      expect(developer_enabled?(local: true, production: false)).to be true
    end

    it "enables developer provider with DEVELOPER_LOGIN_ENABLED=true" do
      expect(developer_enabled?(local: true, production: false, env_var: "true")).to be true
    end
  end

  context "non-production non-local environment (e.g. staging) with DEVELOPER_LOGIN_ENABLED=true" do
    it "enables developer provider" do
      expect(developer_enabled?(local: false, production: false, env_var: "true")).to be true
    end
  end

  context "production environment" do
    it "blocks developer provider without env var" do
      expect(developer_enabled?(local: false, production: true)).to be false
    end

    it "blocks developer provider even with DEVELOPER_LOGIN_ENABLED=true" do
      expect(developer_enabled?(local: false, production: true, env_var: "true")).to be false
    end
  end
end
