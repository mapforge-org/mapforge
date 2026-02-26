require "rails_helper"

describe "Map" do
  let(:user) { create :user }

  context "edit" do
    before do
      visit map.private_map_path
    end

    context "private" do
      subject(:map) { create(:map, edit_permission: "private", user: user) }

      it "is not accessible via link" do
        expect(page).to have_current_path(maps_path)
      end

      it "is accessible for owner" do
        allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
        visit map.private_map_path
        expect_map_loaded
      end
    end

    context "link" do
      subject(:map) { create(:map, edit_permission: "link") }

      it "is accessible via link" do
        expect_map_loaded
      end
    end
  end

  context "view" do
    before do
      visit map.public_map_path
    end

    context "private" do
      subject(:map) { create(:map, view_permission: "private", user: user) }

      it "is not accessible via link" do
        expect(page).to have_current_path(maps_path)
      end

      it "is accessible for owner" do
        allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
        visit map.public_map_path
        expect_map_loaded
      end
    end

    context "link" do
      subject(:map) { create(:map, view_permission: "link") }

      it "is accessible via link" do
        expect_map_loaded
      end
    end

    context "public" do
      subject(:map) { create(:map, view_permission: "public") }

      it "is accessible via link" do
        expect_map_loaded
      end
    end
  end
end
