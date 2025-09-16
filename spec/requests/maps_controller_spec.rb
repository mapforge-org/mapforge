require 'rails_helper'

describe MapsController do
  let(:map) { create(:map) }

  describe '#destroy' do
   it 'fails if not called from owning user or admin' do
     response = delete destroy_map_path(id: map.id)
     expect(response).to redirect_to(maps_path)
     expect(map.reload).not_to be_destroyed
   end
  end

  describe '#demo' do
  let(:user) { create(:user) }

    it 'creates new demo map for each guest user' do
      post demo_path()
      post demo_path()
      expect(Map.demo.count).to eq 2
    end

    it 'creates persistent demo map for each logged in user' do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      post demo_path()
      post demo_path()
      expect(Map.demo.count).to eq 1
   end
  end
end
