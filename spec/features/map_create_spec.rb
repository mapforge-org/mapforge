require "rails_helper"

describe "Create map" do
  let(:user) { create :user }

  before do
    allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    visit root_path
  end

  it "shows description" do
    click_link "Create map"
    expect_map_loaded
  end
end
