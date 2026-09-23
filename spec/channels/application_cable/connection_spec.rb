require "rails_helper"

RSpec.describe ApplicationCable::Connection, type: :channel do
  it "identifies the logged in user from the session" do
    user = create(:user)
    connect "/cable", session: { user_id: user.id }
    expect(connection.current_user).to eq user
  end

  it "connects a visitor without a user" do
    connect "/cable"
    expect(connection.current_user).to be_nil
  end
end
