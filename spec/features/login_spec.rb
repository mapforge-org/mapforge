require "rails_helper"

describe "Login" do
  before do
    visit login_path
  end

  it "shows login options" do
    expect(page).to have_button("Developer Login")
  end

  it "login via developer provider" do
    click_button("Developer Login")
    expect(page).to have_text("User Info")
    fill_in "name", with: "Test User"
    fill_in "email", with: "test@mapforge.org"
    click_button("Sign In")
    expect(page).to have_current_path(my_path)
    expect(User.count).to eq 1
  end

  it "destroys session on logout" do
    click_button("Developer Login")
    fill_in "name", with: "Test User"
    fill_in "email", with: "test@mapforge.org"
    click_button("Sign In")
    expect(page).to have_current_path(my_path)
    expect(User.count).to eq 1
    visit maps_path
    find(".profile-image").click
    click_link("Logout")
    expect(page).to have_current_path(root_path)
  end
end
