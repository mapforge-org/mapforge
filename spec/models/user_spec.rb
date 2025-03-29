require 'rails_helper'

describe User do
  subject(:user) { create :user }

  it 'with defaults' do
    expect(user.maps_count).to be_zero
    expect(user.images_count).to be_zero
  end
end
