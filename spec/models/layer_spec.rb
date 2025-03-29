require 'rails_helper'

describe Layer do
  subject { create(:layer, :with_features) }

  describe '#clone_with_features' do
    it 'returns a clone with cloned features' do
      clone = subject.clone_with_features
      expect(clone.features.count).to eq 2
      expect(clone.features.map(&:id)).not_to match_array(subject.features.map(&:id))
      expect(clone.id).not_to eq subject.id
    end
  end
end
