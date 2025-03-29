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
end
