require "rails_helper"

describe "Feature Garmin export" do
  let(:feature) { create(:feature, :line_string_with_elevation) }
  let(:map) { create(:map, features: [ feature ]) }
  let(:user) { create(:user, garmin_token: { "access_token" => "abc" }) }

  before do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("GARMIN_CLIENT_ID").and_return("id")
    sign_in(user)
  end

  it "offers the upload for a track that was not sent" do
    visit map_path(id: map.private_id, f: feature.id)
    expect(page).to have_css("#feature-export-garmin .garmin-upload .bi-cloud-upload")
    expect(page).to have_css("#feature-export-garmin .garmin-upload", text: "Garmin")
    expect(page).to have_no_css("#feature-export-garmin .garmin-course")
  end

  it "links the course and offers a refresh for a track that was sent" do
    user.update!(garmin_course_ids: { feature.id.to_s => 43 })
    visit map_path(id: map.private_id, f: feature.id)
    expect(page).to have_css("#feature-export-garmin .garmin-upload .bi-arrow-repeat")
    expect(page).to have_css("#feature-export-garmin .garmin-upload", text: "Garmin")
    expect(page).to have_css("#feature-export-garmin a.garmin-course[href='https://connect.garmin.com/modern/course/43'] .bi-box-arrow-up-right")
  end
end
