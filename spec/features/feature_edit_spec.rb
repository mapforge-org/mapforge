require 'rails_helper'

describe 'Feature edit' do
  let(:map) { create(:map) }

  before do
    visit map_path(map)
    expect(page).to have_css("#maplibre-map[map-loaded='true']")
  end

  context 'with empty map' do
    it 'shows feature edit buttons' do
      expect(page).to have_css('.mapbox-gl-draw_line')
      expect(page).to have_css('.mapbox-gl-draw_polygon')
      expect(page).to have_css('.mapbox-gl-draw_point')
    end

    context 'when adding features' do
      it 'adding a point to the map' do
        find('.mapbox-gl-draw_point').click
        expect { click_coord('#maplibre-map', 50, 50) }.to change { Feature.point.count }.by(1)
      end

      it 'adding a polygon to the map' do
        find('.mapbox-gl-draw_polygon').click
        click_coord('#maplibre-map', 10, 10)
        click_coord('#maplibre-map', 10, 50)
        click_coord('#maplibre-map', 50, 50)
        click_coord('#maplibre-map', 50, 10)
        click_coord('#maplibre-map', 10, 10)

        expect(page).to have_text('Map view updated')
        expect(Feature.polygon.count).to eq(1)
      end
    end
  end

  context 'with polygon on map' do
    let!(:polygon) { create(:feature, :polygon_middle, title: 'Poly Title') }
    let(:map) { create(:map, features: [ polygon ]) }

    context 'with selected polygon feature' do
      before do
        click_coord('#maplibre-map', 50, 50)
        expect(page).to have_css('#edit-button-edit')
      end

      it 'shows feature title + details' do
        expect(page).to have_text('Poly Title')
      end

      it 'adds feature id to url' do
        expect(page).to have_current_path("/m/#{map.id}?f=#{polygon.id}")
      end

      it 'can raw update feature' do
        find('#edit-button-edit').click
        sleep(0.3) # edit triggers modal pull-up
        find('#edit-button-raw').click
        expect(page).to have_selector('textarea[name="properties"]')
        fill_in 'properties', with: '{"title": "TEST"}'
        expect { find('.feature-update').click }.to change { polygon.reload.properties['title'] }
      end

      it 'can delete feature' do
        accept_alert do
          find('#edit-button-trash').click
        end
        # the actioncable events of map + feature update are not always received in the same order:
        expect(page).to have_text("Deleting feature #{polygon.id}")
          .or have_text('Map properties updated')
          .or have_text('Map view updated')
        expect(Feature.count).to eq(0)
      end

      it 'shows feature meta data' do
        find('#edit-button-edit').click
        expect(page).to have_text('27.70 km²')
      end
    end
  end

  context 'with point on map' do
    let(:point) { create(:feature, :point_middle, title: 'Point Title') }
    let(:map) { create(:map, features: [ point ]) }

    context 'with selected point feature' do
      before do
        click_coord('#maplibre-map', 50, 50)
        find('#edit-button-edit').click
      end

      it 'can update point size' do
        find('#point-size').set(15)
        expect(page).to have_selector('#point-size-val', text: '15')
        expect(point.reload.properties['marker-size']).to eq('15')
      end

      it 'can update title' do
        fill_in 'feature-title', with: "New Title"
        wait_for { point.reload.properties['title'] }.to eq('New Title')
      end

      it 'can update label' do
        expect(page).to_not have_selector('#feature-label')
        click_button 'Add label'
        expect(page).to have_selector('#feature-label')
        fill_in 'feature-label', with: "New Label"
        wait_for { point.reload.properties['label'] }.to eq('New Label')
      end

      it 'can update desc' do
        expect(page).to_not have_selector('#feature-desc-input')
        click_button 'Add description'
        expect(page).to have_text('Add a description text')
        text_area = find(:css, '.CodeMirror textarea', visible: false)
        text_area.set('New Desc')
        wait_for { point.reload.properties['desc'] }.to eq('New Desc')
      end

      it 'can update fill color' do
        find('#fill-color').set('#aabbcc')
        wait_for { point.reload.properties['marker-color'] }.to eq('#aabbcc')
      end

      it 'can set fill color transparent' do
        # TODO: did not find a better solution to check the box and trigger stimulus
        js = "document.getElementById('fill-color-transparent')"
        page.driver.execute_script("#{js}.dispatchEvent(new Event('click'))")
        page.driver.execute_script("#{js}.dispatchEvent(new Event('input'))")
        page.driver.execute_script("#{js}.dispatchEvent(new Event('change'))")

        wait_for { point.reload.properties['marker-color'] }.to eq('transparent')
      end

      it 'can update outline color' do
        find('#stroke-color').set('#aabbcc')
        wait_for { point.reload.properties['stroke'] }.to eq('#aabbcc')
      end

      it 'can upload image' do
        image_path = Rails.root.join('public', 'icons', 'mapforge-logo.png')
        expect(page).to have_selector('#marker-image')
        attach_file('marker-image', image_path)

        wait_for { point.reload.properties['marker-image-url'] }.to match(/icon\/.+/)
      end
    end
  end

  context 'with lost websocket' do
    it 'disables edit buttons' do
      ActionCable.server.connections.each(&:close)
      expect(page).to have_css('.mapbox-gl-draw_ctrl-draw-btn[disabled]')
    end
  end
end
