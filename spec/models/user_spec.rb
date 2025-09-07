require 'rails_helper'

describe User do
  subject(:user) { create :user }

  it 'with defaults' do
    expect(user.maps_count).to be_zero
    expect(user.images_count).to be_zero
    expect(user.recent_map_ids).to eq([])
  end

  describe '#track_map_view' do
    let(:map1) { create :map }
    let(:map2) { create :map }
    let(:map3) { create :map }

    it 'adds maps to the recent_map_ids list' do
      user.track_map_view(map1.id)
      expect(user.recent_map_ids).to eq([ map1.id.to_s ])

      user.track_map_view(map2.id)
      expect(user.recent_map_ids).to eq([ map2.id.to_s, map1.id.to_s ])
    end

    it 'moves a map to the beginning of the list if viewed again' do
      user.track_map_view(map1.id)
      user.track_map_view(map2.id)
      user.track_map_view(map1.id)

      expect(user.recent_map_ids).to eq([ map1.id.to_s, map2.id.to_s ])
    end

    it 'limits the list size to the specified max_history' do
      user.track_map_view(map1.id, max_history: 2)
      user.track_map_view(map2.id, max_history: 2)
      user.track_map_view(map3.id, max_history: 2)

      expect(user.recent_map_ids.size).to eq(2)
      expect(user.recent_map_ids).to eq([ map3.id.to_s, map2.id.to_s ])
    end
  end
end
