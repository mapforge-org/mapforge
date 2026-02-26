require "rails_helper"

describe Image do
  describe "#public_id_must_be_unique_or_nil" do
    context "when image with same public_id already exists" do
      before { create(:image, public_id: "frontpage") }

      it "raises error" do
        expect { create(:image, public_id: "frontpage") }
          .to raise_error(Mongoid::Errors::Validations, /has already been taken/)
      end
    end
  end
end
