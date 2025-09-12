require 'rails_helper'

describe 'Playground' do
  context 'on frontpage' do
    before do
      visit root_path
    end

    it 'links to playground' do
      expect(page).to have_link('playground', href: playground_path)
    end
  end

  context 'on playground' do
    before do
      visit playground_path
    end

    it 'Imports map' do
      expect_map_loaded
      expect(Map.find_by(public_id: "playground").name).to eq("Playground")
    end
  end
end
