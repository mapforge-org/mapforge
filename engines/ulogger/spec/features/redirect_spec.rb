require 'rails_helper'

describe 'Redirect to map' do
  let!(:map) { Map.create(private_id: "000000000000000000001234", name: "ulogger map") }

  context 'clicking share link in ulogger app' do
    it 'redirects to public map view' do
      visit "/ulogger/#1234"
      expect(page).to have_current_path("/m/#{map.public_id}/ulogger%20map")
      expect(page).to have_text("ulogger map")
    end
  end
end
