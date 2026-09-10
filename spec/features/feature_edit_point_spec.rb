require "rails_helper"

describe "Feature edit, point features" do
  include_context "with an editable map and an elevation stub"

  context "with point on map" do
    let(:point) { create(:feature, :point_middle, title: "Point Title") }
    let(:map) { create(:map, features: [ point ]) }

    context "with selected point feature" do
      before do
        click_coord("#maplibre-map", 512, 430)
        find("#edit-button-edit").click
      end

      it "can update point size" do
        find("#edit-button-style").click
        find("#point-size").set(15)
        expect(page).to have_selector("#point-size-val", text: "15")
        expect(point.reload.properties["marker-size"]).to eq("15")
      end

      it "can update title" do
        fill_in "feature-title", with: "New Title"
        wait_for { point.reload.properties["title"] }.to eq("New Title")
      end

      it "can toggle title visibility on map" do
        fill_in "feature-title", with: "New Title"
        check "Show title on map"
        wait_for { point.reload.properties["label"] }.to eq("New Title")

        uncheck "Show title on map"
        wait_for { point.reload.properties["label"] }.to be_nil
      end

      it "can update desc" do
        expect(page).not_to have_selector("#feature-desc-input")
        click_button "Add description"
        expect(page).to have_text("Add a description text")
        text_area = find(:css, ".CodeMirror textarea", visible: false)
        text_area.set("New Desc")
        wait_for { point.reload.properties["desc"] }.to eq("New Desc")
      end

      it "can update fill color" do
        find("#edit-button-style").click
        color = "#aa00cc"
        set_color_input("#fill-color", color)

        wait_for { point.reload.properties["marker-color"] }.to eq(color)
      end

      it "can set fill color transparent" do
        find("#edit-button-style").click
        expect(find("#fill-color-transparent")).not_to be_checked

        find("#fill-color-transparent").check

        wait_for { point.reload.properties["marker-color"] }.to eq("transparent")
      end

      it "can update outline color" do
        find("#edit-button-style").click
        color = "#aa00cc"
        set_color_input("#stroke-color", color)

        wait_for { point.reload.properties["stroke"] }.to eq(color)
      end

      it "can upload image" do
        find("#edit-button-style").click
        image_path = Rails.root.join("spec", "fixtures", "files", "mapforge-logo-icon.png")
        page.driver.execute_script("document.querySelector('#marker-image').classList.remove('hidden')")
        expect(page).to have_selector("#marker-image")
        attach_file("marker-image", image_path)

        wait_for { point.reload.properties["marker-image-url"] }.to match(/icon\/.+/)
        wait_for { point.reload.image&.public_id }.to match(/mapforge-logo-icon-\d+.webp/)
      end

      it "can upload image bigger 1024px" do
        find("#edit-button-style").click
        image_path = Rails.root.join("spec", "fixtures", "files", "image_large.jpg")
        page.driver.execute_script("document.querySelector('#marker-image').classList.remove('hidden')")
        expect(page).to have_selector("#marker-image")
        attach_file("marker-image", image_path)

        wait_for { point.reload.properties["marker-image-url"] }.to match(/icon\/.+/)
      end

      it "can use emoji selector" do
        find("#edit-button-style").click
        find("#marker-symbol-select").click
        expect(page).to have_selector("em-emoji-picker")

        # Cannot select in shadow dom wiht capybara
        shadow_host = find("em-emoji-picker")
        page.execute_script(<<~JS, shadow_host)
          const host = arguments[0];
          const shadow = host.shadowRoot;
          if (shadow) {
            const el = shadow.querySelector('span.emoji-mart-emoji');
            el.click();
          }
        JS

        wait_for { point.reload.properties["marker-symbol"] }.to match("👍")
      end

      it "can select an icon of an icon set" do
        find("#edit-button-style").click
        find("#marker-symbol-select").click
        expect(page).to have_selector("em-emoji-picker")

        # An icon of a set is only rendered once its row is visible, so it gets searched for
        page.execute_script(<<~JS)
          const shadow = document.querySelector('em-emoji-picker').shadowRoot;
          const input = shadow.querySelector('input[type="search"]');
          input.value = 'cafe';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        JS

        # Scoped to the grid: while the grid icon waits for its lazy src, a hover preview of
        # the same icon keeps its own src, and that copy carries no click handler.
        icon = "document.querySelector('em-emoji-picker').shadowRoot" \
          ".querySelector('.scroll img[src=\"/icon-sets/maki/cafe.png\"]')"
        wait_for { page.evaluate_script("!!#{icon}") }.to be true
        page.execute_script("#{icon}.closest('button').click()")

        wait_for { point.reload.properties["marker-symbol"] }.to eq("/icon-sets/maki/cafe.png")
      end

      it "can remove the symbol" do
        find("#edit-button-style").click
        find("#marker-symbol-select").click
        shadow_host = find("em-emoji-picker")
        page.execute_script(<<~JS, shadow_host)
          arguments[0].shadowRoot.querySelector('span.emoji-mart-emoji').click();
        JS
        wait_for { point.reload.properties["marker-symbol"] }.to be_present

        find("#marker-symbol-ui .marker-remove").click

        wait_for { point.reload.properties["marker-symbol"] }.to be_nil
      end
    end

    it "can copy feature via context menu" do
      click_coord("#maplibre-map", 512, 430, button: :right)
      expect(page).to have_text("Copy")
      find(".context-menu-item", text: "Copy").click
      expect(page).to have_text("Point copied to clipboard")
      expect(page).to have_text("Details")
    end

    it "pastes a copied feature at the clicked position" do
      click_coord("#maplibre-map", 512, 430, button: :right)
      find(".context-menu-item", text: "Copy").click
      expect(page).to have_text("Point copied to clipboard")

      # a feature under the cursor gets its own menu items, without the paste option
      click_coord("#maplibre-map", 512, 430, button: :right)
      expect(page).to have_css(".context-menu-item", text: "Copy")
      expect(page).to have_no_css(".context-menu-item", text: "Paste")

      target = page.evaluate_script("[window.map.unproject([300, 300]).lng, window.map.unproject([300, 300]).lat]")
      click_coord("#maplibre-map", 300, 300, button: :right)
      find(".context-menu-item", text: "Paste Point").click
      wait_for { Feature.point.count }.to eq(2)

      coordinates = Feature.point.last.geometry["coordinates"]
      expect(coordinates[0]).to be_within(0.001).of(target[0])
      expect(coordinates[1]).to be_within(0.001).of(target[1])
    end

    it "pastes with ctrl+v at the cursor position" do
      hover_coord(300, 300)
      target = page.evaluate_script("[window.map.unproject([300, 300]).lng, window.map.unproject([300, 300]).lat]")

      # headless Chrome denies clipboard writes, so the paste event carries the data
      page.execute_script(<<~JS)
        const data = new DataTransfer()
        data.setData('text', JSON.stringify({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [ 1, 1 ] },
          properties: { title: 'Pasted' }
        }))
        window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
      JS
      wait_for { Feature.point.count }.to eq(2)

      coordinates = Feature.point.last.geometry["coordinates"]
      expect(coordinates[0]).to be_within(0.001).of(target[0])
      expect(coordinates[1]).to be_within(0.001).of(target[1])
    end

    it "does not read the clipboard on right click" do
      page.execute_script("window.clipboardReads = 0")
      page.execute_script(<<~JS)
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          readText: async () => { window.clipboardReads += 1; return '' }
        }})
      JS

      click_coord("#maplibre-map", 300, 300, button: :right)
      expect(page).to have_no_css(".context-menu-item")
      expect(page.evaluate_script("window.clipboardReads")).to eq(0)
    end

    it "can delete feature via context menu" do
      click_coord("#maplibre-map", 512, 430, button: :right)
      expect(page).to have_text("Delete")
      accept_alert do
        find(".context-menu-item", text: "Delete").click
      end
      expect(page).to have_text("Point deleted")
      # need to wait until feature is saved server side
      wait_for { Feature.count }.to eq(0)
    end
  end

  context "with two points on map" do
    let(:point) { create(:feature, :point_middle, title: "Point Title") }
    let(:colored_point) { create(:feature, :point, properties: { "marker-color" => "#123456" }) }
    let(:map) { create(:map, features: [ point, colored_point ]) }

    it "offers colors of other features and the palette as picker presets" do
      click_coord("#maplibre-map", 512, 430)
      find("#edit-button-edit").click
      find("#edit-button-style").click
      presets = page.evaluate_script(
        "Array.from(document.querySelectorAll('#color-presets option')).map(o => o.value)")

      expect(presets.first).to eq("#123456") # used by the other point
      expect(presets).to include("#e5e5d7") # --color-light-sand
      expect(presets.size).to eq(8) # list is capped
    end
  end

  context "cycling through overlapping features" do
    let(:polygon) { create(:feature, :polygon_middle, title: "Poly") }
    let(:point1) { create(:feature, :point_middle, title: "Point 1") }
    let(:point2) { create(:feature, :point_middle, title: "Point 2") }
    let(:map) { create(:map, features: [ polygon, point1, point2 ]) }

    it "cycles through all overlapping features on repeated clicks" do
      titles = []
      3.times do
        click_center_of_screen
        expect(page).to have_css("#feature-details-modal.show")
        titles << find("#feature-title").text
      end
      expect(titles.uniq).to contain_exactly("Poly", "Point 1", "Point 2")
    end
  end

  context "with cursor sharing" do
    let(:map) { create(:map, name: "Share Cursor", share_cursor: true) }

    it "sends cursor positions" do
      hover_coord(70, 70)
      expect(page).to have_css("#maplibre-map")
    end
  end

  context "with lost websocket" do
    it "disables edit buttons" do
      ActionCable.server.connections.each(&:close)
      expect(page).to have_css(".mapbox-gl-draw_ctrl-draw-btn[disabled]")
    end
  end
end
