require "rails_helper"

describe "Frontpage" do
  context "when not logged in" do
    before do
      visit root_path
    end

    it "shows frontpage description" do
      expect(page).to have_text("Create your own maps")
    end
  end

  context "when logged in" do
    let(:user) { create :user }

    before do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      visit root_path
    end

    it "links to your maps and create" do
      expect(page).to have_link("your maps", href: "/my")
      expect(page).to have_link("create", href: "/m")
    end
  end
end
