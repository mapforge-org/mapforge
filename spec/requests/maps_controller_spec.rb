require 'rails_helper'

describe MapsController do
  let(:map) { create(:map) }

  describe '#destroy' do
   it 'fails if not called from owning user or admin' do
     response = delete destroy_map_path(id: map.private_id)
     expect(response).to redirect_to(maps_path)
     expect(map.reload).not_to be_destroyed
   end
  end

  describe '#tutorial' do
  let(:user) { create(:user) }

    it 'creates new tutorial map for each guest user' do
      post tutorial_path()
      post tutorial_path()
      expect(Map.tutorial.count).to eq 2
    end

    it 'creates persistent tutorial map for each logged in user' do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      post tutorial_path()
      post tutorial_path()
      expect(Map.tutorial.count).to eq 1
   end
  end
end
