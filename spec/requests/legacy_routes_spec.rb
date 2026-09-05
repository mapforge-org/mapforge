require "rails_helper"

describe "legacy routes" do
  # a 'marker-image-url' that was saved before the move still points at /emojis
  describe "the emoji directory" do
    it "redirects to the icon set and keeps the file extension" do
      get "/emojis/noto/heart.png"

      expect(response).to redirect_to("/icon-sets/noto/heart.png")
    end

    it "redirects an emoji character" do
      get "/emojis/noto/%F0%9F%91%8D.png"

      expect(response).to redirect_to("/icon-sets/noto/%F0%9F%91%8D.png")
    end
  end
end
