# Dockerfile to speed up github actions CI runs

# podman build -t ghcr.io/mapforge-org/mapforge-ci-runner:latest .
# echo 'token' | podman login ghcr.io -u mapforge-org --password-stdin
# podman push ghcr.io/mapforge-org/mapforge-ci-runner:latest

# syntax = docker/dockerfile:1.2

# Make sure RUBY_VERSION matches the Ruby version in .ruby-version and Gemfile
ARG RUBY_VERSION=3.4.5
FROM registry.docker.com/library/ruby:$RUBY_VERSION-slim as base

LABEL org.opencontainers.image.source="https://github.com/mapforge-org/mapforge"
LABEL org.opencontainers.image.licenses="MIT"

# Throw-away build stage to reduce size of final image
FROM base as os-dependencies
LABEL org.opencontainers.image.description="OS container for Mapforge"

# Install packages needed to build gems
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y libyaml-dev ruby-dev build-essential git npm libvips pkg-config libproj-dev proj-bin libimlib2-dev

# Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y libjemalloc2 vim less curl iputils-ping libsqlite3-0 libvips proj-bin wget gnupg ca-certificates imagemagick libimlib2 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Install chrome for webdriver tests & screenshots (adds 400MB :-o)
# Add Google's public key + repo
RUN wget -q -O /usr/share/keyrings/google-linux-signing-keyring.gpg https://dl-ssl.google.com/linux/linux_signing_key.pub
RUN echo "deb [signed-by=/usr/share/keyrings/google-linux-signing-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Update packages again and install Google Chrome
RUN apt-get update -qq && apt-get install --no-install-recommends -y google-chrome-stable fonts-noto-color-emoji

RUN apt-get clean && rm -rf /var/lib/apt/lists /var/cache/apt/archives
