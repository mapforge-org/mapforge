require 'rails_helper'

describe 'Playground' do
  before do
    visit playground_path
  end

  it 'Imports map' do
    expect_map_loaded
    expect(Map.find_by(public_id: "playground").name).to eq("Playground")
  end
end
